import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import {
  getPortfolios,
  getPortfolio,
  updatePortfolio,
  generateId,
  type TransactionData,
  type HoldingData,
} from "@/lib/gdrive";

/** Error whose message is safe to surface to the client as a 400. */
class TradeError extends Error {}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const portfolioId = searchParams.get("portfolioId");

  const portfolios = await getPortfolios();

  const allTransactions: (TransactionData & { portfolioId: string })[] = [];
  for (const p of portfolios) {
    if (portfolioId && p.id !== portfolioId) continue;
    for (const t of p.transactions) {
      allTransactions.push({ ...t, portfolioId: p.id });
    }
  }

  // Sort by date desc, take 100
  allTransactions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json(allTransactions.slice(0, 100));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { symbol, companyName, portfolioId } = body;
  const type = String(body.type || "").toUpperCase();
  const quantity = Number(body.quantity);
  const price = Number(body.price);

  // ── Input validation ──
  if (!symbol || !portfolioId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (type !== "BUY" && type !== "SELL") {
    return NextResponse.json({ error: "Invalid trade type" }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 });
  }

  const existsCheck = await getPortfolio(portfolioId);
  if (!existsCheck) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const total = quantity * price;
  const now = new Date().toISOString();
  let transaction: TransactionData;

  try {
    // All validation + mutation happens inside the atomic write so a concurrent
    // trade can't oversell or double-spend cash.
    await updatePortfolio(portfolioId, (portfolio) => {
      const existingIdx = portfolio.holdings.findIndex((h) => h.symbol === symbol);
      // Cost basis captured before mutating, for realized P&L on a SELL.
      const sellAvgPrice = existingIdx >= 0 ? portfolio.holdings[existingIdx].avgPrice : 0;

      if (type === "BUY") {
        if (portfolio.cashBalance < total) {
          throw new TradeError("Insufficient cash balance");
        }
        portfolio.cashBalance -= total;
        if (existingIdx >= 0) {
          const ex = portfolio.holdings[existingIdx];
          const newQty = ex.quantity + quantity;
          portfolio.holdings[existingIdx] = {
            ...ex,
            quantity: newQty,
            avgPrice: (ex.avgPrice * ex.quantity + price * quantity) / newQty,
            updatedAt: now,
          };
        } else {
          const holding: HoldingData = {
            id: generateId(),
            symbol,
            companyName: companyName || symbol,
            quantity,
            avgPrice: price,
            createdAt: now,
            updatedAt: now,
          };
          portfolio.holdings.push(holding);
        }
      } else {
        // SELL
        if (existingIdx === -1 || portfolio.holdings[existingIdx].quantity < quantity) {
          throw new TradeError("Insufficient shares to sell");
        }
        portfolio.cashBalance += total;
        const ex = portfolio.holdings[existingIdx];
        const newQty = ex.quantity - quantity;
        if (newQty === 0) portfolio.holdings.splice(existingIdx, 1);
        else portfolio.holdings[existingIdx] = { ...ex, quantity: newQty, updatedAt: now };
      }

      // Realized P&L on SELL = (sale price − avg cost) × qty.
      const realizedPnl =
        type === "SELL" ? (price - sellAvgPrice) * quantity : undefined;

      transaction = {
        id: generateId(),
        type,
        symbol,
        companyName: companyName || symbol,
        quantity,
        price,
        total,
        portfolioId,
        createdAt: now,
        ...(realizedPnl !== undefined ? { realizedPnl } : {}),
      };
      portfolio.transactions.push(transaction);
      return portfolio;
    });
  } catch (err) {
    if (err instanceof TradeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  return NextResponse.json(transaction!);
}
