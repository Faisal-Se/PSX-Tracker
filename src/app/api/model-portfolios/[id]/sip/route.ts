import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import {
  getModelPortfolio,
  updateModelPortfolio,
  generateId,
} from "@/lib/gdrive";
import { getMarketWatch } from "@/lib/psx";

/**
 * Atomic SIP: deposit cash and execute the buy plan in ONE Drive write so a
 * failed buy leg can never leave orphaned cash (the previous client-side
 * add-cash-then-bulk-trade sequence could).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const amount = Number(body.amount);
  const trades = (body.trades || []) as {
    symbol: string;
    companyName: string;
    quantity: number;
    price?: number;
  }[];

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "SIP amount must be a positive number" },
      { status: 400 }
    );
  }

  const model = await getModelPortfolio(id);
  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const marketData = await getMarketWatch();
  const priceMap = new Map(marketData.map((s) => [s.symbol, s.current]));

  // Resolve + validate buy legs.
  let totalCost = 0;
  const resolved: { symbol: string; companyName: string; quantity: number; price: number; total: number }[] = [];
  for (const t of trades) {
    if (!Number.isFinite(t.quantity) || t.quantity <= 0) continue;
    const price = t.price && t.price > 0 ? t.price : priceMap.get(t.symbol) || 0;
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: `Cannot find price for ${t.symbol}` },
        { status: 400 }
      );
    }
    const total = t.quantity * price;
    totalCost += total;
    resolved.push({ symbol: t.symbol, companyName: t.companyName, quantity: t.quantity, price, total });
  }

  // Deposit must cover the plan (the rest stays as cash).
  if (totalCost > amount + 0.01) {
    return NextResponse.json(
      { error: `Buy plan (PKR ${totalCost.toFixed(0)}) exceeds the SIP amount (PKR ${amount.toFixed(0)})` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  const updated = await updateModelPortfolio(id, (m) => {
    // 1) deposit
    m.cashBalance += amount;
    m.transactions.push({
      id: generateId(),
      type: "CASH_IN",
      symbol: "CASH",
      companyName: "SIP Deposit",
      quantity: 0,
      price: 0,
      total: amount,
      createdAt: now,
    });

    // 2) buys
    for (const trade of resolved) {
      m.cashBalance -= trade.total;
      m.transactions.push({
        id: generateId(),
        type: "BUY",
        symbol: trade.symbol,
        companyName: trade.companyName,
        quantity: trade.quantity,
        price: trade.price,
        total: trade.total,
        createdAt: now,
      });
      const idx = m.allocations.findIndex((a) => a.symbol === trade.symbol);
      if (idx >= 0) {
        const ex = m.allocations[idx];
        const newShares = ex.shares + trade.quantity;
        m.allocations[idx] = {
          ...ex,
          shares: newShares,
          avgPrice: (ex.avgPrice * ex.shares + trade.price * trade.quantity) / newShares,
          updatedAt: now,
        };
      } else {
        m.allocations.push({
          id: generateId(),
          symbol: trade.symbol,
          companyName: trade.companyName,
          percentage: 0,
          shares: trade.quantity,
          avgPrice: trade.price,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 3) refresh percentages
    let totalValue = m.cashBalance;
    for (const a of m.allocations) {
      if (a.symbol === "CASH") continue;
      totalValue += a.shares * (priceMap.get(a.symbol) || a.avgPrice);
    }
    if (totalValue > 0) {
      for (const a of m.allocations) {
        const price = a.symbol === "CASH" ? 0 : priceMap.get(a.symbol) || a.avgPrice;
        const value = a.symbol === "CASH" ? m.cashBalance : a.shares * price;
        a.percentage = Math.round((value / totalValue) * 1000) / 10;
      }
    }
    return m;
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...updated,
    allocations: [...updated.allocations].sort((a, b) => b.percentage - a.percentage),
    transactions: [...updated.transactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100),
  });
}
