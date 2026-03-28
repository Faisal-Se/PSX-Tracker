import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import { getPortfolios, savePortfolios, generateId } from "@/lib/gdrive";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { portfolioId, trades } = body as {
    portfolioId: string;
    trades: {
      type: "BUY" | "SELL";
      symbol: string;
      companyName: string;
      quantity: number;
      price: number;
    }[];
  };

  if (!portfolioId) {
    return NextResponse.json(
      { error: "Portfolio is required" },
      { status: 400 }
    );
  }

  if (!trades || trades.length === 0) {
    return NextResponse.json(
      { error: "No trades to import" },
      { status: 400 }
    );
  }

  const portfolios = await getPortfolios();
  const pIdx = portfolios.findIndex((p) => p.id === portfolioId);

  if (pIdx === -1) {
    return NextResponse.json(
      { error: "Portfolio not found" },
      { status: 404 }
    );
  }

  const portfolio = portfolios[pIdx];

  // Validate trades
  for (const trade of trades) {
    if (!trade.symbol || !trade.quantity || !trade.price) {
      return NextResponse.json(
        { error: `Invalid trade data for ${trade.symbol || "unknown"}` },
        { status: 400 }
      );
    }
    if (trade.type === "SELL") {
      const holding = portfolio.holdings.find(
        (h) => h.symbol === trade.symbol
      );
      if (!holding || holding.quantity < trade.quantity) {
        return NextResponse.json(
          {
            error: `Insufficient shares for ${trade.symbol}. Have ${holding?.quantity || 0}, trying to sell ${trade.quantity}`,
          },
          { status: 400 }
        );
      }
    }
  }

  // Calculate total cost
  const totalBuyCost = trades
    .filter((t) => t.type === "BUY")
    .reduce((sum, t) => sum + t.quantity * t.price, 0);
  const totalSellProceeds = trades
    .filter((t) => t.type === "SELL")
    .reduce((sum, t) => sum + t.quantity * t.price, 0);
  const netCash = totalSellProceeds - totalBuyCost;

  if (portfolio.cashBalance + netCash < 0) {
    return NextResponse.json(
      {
        error: `Insufficient cash. Need PKR ${Math.abs(netCash).toFixed(0)}, have PKR ${portfolio.cashBalance.toFixed(0)}`,
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  // Execute all trades
  for (const trade of trades) {
    const total = trade.quantity * trade.price;

    portfolio.transactions.push({
      id: generateId(),
      type: trade.type,
      symbol: trade.symbol,
      companyName: trade.companyName,
      quantity: trade.quantity,
      price: trade.price,
      total,
      portfolioId,
      createdAt: now,
    });

    const existingIdx = portfolio.holdings.findIndex(
      (h) => h.symbol === trade.symbol
    );

    if (trade.type === "BUY") {
      if (existingIdx >= 0) {
        const existing = portfolio.holdings[existingIdx];
        const newQty = existing.quantity + trade.quantity;
        const newAvg =
          (existing.avgPrice * existing.quantity +
            trade.price * trade.quantity) /
          newQty;
        portfolio.holdings[existingIdx] = {
          ...existing,
          quantity: newQty,
          avgPrice: newAvg,
          updatedAt: now,
        };
      } else {
        portfolio.holdings.push({
          id: generateId(),
          symbol: trade.symbol,
          companyName: trade.companyName,
          quantity: trade.quantity,
          avgPrice: trade.price,
          createdAt: now,
          updatedAt: now,
        });
      }
    } else {
      if (existingIdx >= 0) {
        const existing = portfolio.holdings[existingIdx];
        const newQty = existing.quantity - trade.quantity;
        if (newQty <= 0) {
          portfolio.holdings.splice(existingIdx, 1);
        } else {
          portfolio.holdings[existingIdx] = {
            ...existing,
            quantity: newQty,
            updatedAt: now,
          };
        }
      }
    }
  }

  portfolio.cashBalance += netCash;
  portfolio.updatedAt = now;
  portfolios[pIdx] = portfolio;
  await savePortfolios(portfolios);

  return NextResponse.json({
    success: true,
    imported: trades.length,
    newCashBalance: portfolio.cashBalance,
  });
}
