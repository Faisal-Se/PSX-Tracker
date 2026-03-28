import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import {
  getPortfolios,
  savePortfolios,
  generateId,
  type TransactionData,
  type HoldingData,
} from "@/lib/gdrive";

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

  const { type, symbol, companyName, quantity, price, portfolioId } =
    await req.json();

  if (!type || !symbol || !quantity || !price || !portfolioId) {
    return NextResponse.json(
      { error: "Missing required fields" },
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
  const total = quantity * price;
  const now = new Date().toISOString();

  if (type === "BUY") {
    if (portfolio.cashBalance < total) {
      return NextResponse.json(
        { error: "Insufficient cash balance" },
        { status: 400 }
      );
    }

    portfolio.cashBalance -= total;

    const existingIdx = portfolio.holdings.findIndex(
      (h) => h.symbol === symbol
    );
    if (existingIdx >= 0) {
      const existing = portfolio.holdings[existingIdx];
      const newQuantity = existing.quantity + quantity;
      const newAvgPrice =
        (existing.avgPrice * existing.quantity + price * quantity) / newQuantity;
      portfolio.holdings[existingIdx] = {
        ...existing,
        quantity: newQuantity,
        avgPrice: newAvgPrice,
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
  } else if (type === "SELL") {
    const existingIdx = portfolio.holdings.findIndex(
      (h) => h.symbol === symbol
    );
    if (
      existingIdx === -1 ||
      portfolio.holdings[existingIdx].quantity < quantity
    ) {
      return NextResponse.json(
        { error: "Insufficient shares to sell" },
        { status: 400 }
      );
    }

    portfolio.cashBalance += total;

    const existing = portfolio.holdings[existingIdx];
    const newQuantity = existing.quantity - quantity;
    if (newQuantity === 0) {
      portfolio.holdings.splice(existingIdx, 1);
    } else {
      portfolio.holdings[existingIdx] = {
        ...existing,
        quantity: newQuantity,
        updatedAt: now,
      };
    }
  }

  const transaction: TransactionData = {
    id: generateId(),
    type,
    symbol,
    companyName: companyName || symbol,
    quantity,
    price,
    total,
    portfolioId,
    createdAt: now,
  };

  portfolio.transactions.push(transaction);
  portfolio.updatedAt = now;
  portfolios[pIdx] = portfolio;
  await savePortfolios(portfolios);

  return NextResponse.json(transaction);
}
