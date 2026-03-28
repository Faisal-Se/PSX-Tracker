import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import {
  getModelPortfolio,
  updateModelPortfolio,
  generateId,
  type ModelAllocationData,
} from "@/lib/gdrive";
import { getMarketWatch } from "@/lib/psx";

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
  const { allocations } = body as {
    allocations: { symbol: string; companyName: string; percentage: number }[];
  };

  if (!allocations || allocations.length === 0) {
    return NextResponse.json(
      { error: "Allocations are required" },
      { status: 400 }
    );
  }

  const totalPct = allocations.reduce((sum, a) => sum + a.percentage, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    return NextResponse.json(
      {
        error: `Allocations must sum to 100% (currently ${totalPct.toFixed(1)}%)`,
      },
      { status: 400 }
    );
  }

  const model = await getModelPortfolio(id);
  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch current market prices
  const marketData = await getMarketWatch();
  const priceMap = new Map(marketData.map((s) => [s.symbol, s.current]));

  // Calculate total portfolio value
  let totalValue = model.cashBalance;
  for (const alloc of model.allocations) {
    if (alloc.symbol === "CASH") continue;
    const price = priceMap.get(alloc.symbol) || alloc.avgPrice;
    totalValue += alloc.shares * price;
  }

  const currentMap = new Map(model.allocations.map((a) => [a.symbol, a]));
  const now = new Date().toISOString();

  const trades: {
    type: "BUY" | "SELL";
    symbol: string;
    companyName: string;
    quantity: number;
    price: number;
    total: number;
  }[] = [];

  const newAllocations: ModelAllocationData[] = [];
  let cashDelta = 0;

  for (const alloc of allocations) {
    if (alloc.symbol === "CASH") {
      newAllocations.push({
        id: generateId(),
        symbol: "CASH",
        companyName: "Cash Reserve",
        percentage: alloc.percentage,
        shares: 0,
        avgPrice: 0,
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }

    const currentPrice = priceMap.get(alloc.symbol);
    if (!currentPrice || currentPrice <= 0) {
      return NextResponse.json(
        { error: `Cannot find market price for ${alloc.symbol}` },
        { status: 400 }
      );
    }

    const targetValue = (alloc.percentage / 100) * totalValue;
    const targetShares = Math.floor(targetValue / currentPrice);
    const existing = currentMap.get(alloc.symbol);
    const currentShares = existing?.shares || 0;
    const currentAvgPrice = existing?.avgPrice || 0;
    const diff = targetShares - currentShares;

    if (diff > 0) {
      const cost = diff * currentPrice;
      cashDelta -= cost;
      trades.push({
        type: "BUY",
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        quantity: diff,
        price: currentPrice,
        total: cost,
      });
      const newAvgPrice =
        currentShares > 0
          ? (currentAvgPrice * currentShares + currentPrice * diff) /
            targetShares
          : currentPrice;
      newAllocations.push({
        id: existing?.id || generateId(),
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        percentage: alloc.percentage,
        shares: targetShares,
        avgPrice: newAvgPrice,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      });
    } else if (diff < 0) {
      const sellQty = Math.abs(diff);
      const proceeds = sellQty * currentPrice;
      cashDelta += proceeds;
      trades.push({
        type: "SELL",
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        quantity: sellQty,
        price: currentPrice,
        total: proceeds,
      });
      newAllocations.push({
        id: existing?.id || generateId(),
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        percentage: alloc.percentage,
        shares: targetShares,
        avgPrice: currentAvgPrice,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      });
    } else {
      newAllocations.push({
        id: existing?.id || generateId(),
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        percentage: alloc.percentage,
        shares: currentShares,
        avgPrice: currentAvgPrice,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      });
    }
  }

  // Sell removed stocks
  const newSymbols = new Set(allocations.map((a) => a.symbol));
  for (const existing of model.allocations) {
    if (existing.symbol === "CASH") continue;
    if (!newSymbols.has(existing.symbol) && existing.shares > 0) {
      const currentPrice =
        priceMap.get(existing.symbol) || existing.avgPrice;
      const proceeds = existing.shares * currentPrice;
      cashDelta += proceeds;
      trades.push({
        type: "SELL",
        symbol: existing.symbol,
        companyName: existing.companyName,
        quantity: existing.shares,
        price: currentPrice,
        total: proceeds,
      });
    }
  }

  const newCashBalance = model.cashBalance + cashDelta;
  if (newCashBalance < -0.01) {
    return NextResponse.json(
      {
        error: `Insufficient cash. Need PKR ${Math.abs(cashDelta).toFixed(0)} more. Add cash first.`,
      },
      { status: 400 }
    );
  }

  const updated = await updateModelPortfolio(id, (m) => {
    m.allocations = newAllocations;
    m.cashBalance = Math.max(0, newCashBalance);
    for (const trade of trades) {
      m.transactions.push({
        id: generateId(),
        type: trade.type,
        symbol: trade.symbol,
        companyName: trade.companyName,
        quantity: trade.quantity,
        price: trade.price,
        total: trade.total,
        createdAt: now,
      });
    }
    return m;
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    model: {
      ...updated,
      allocations: [...updated.allocations].sort(
        (a, b) => b.percentage - a.percentage
      ),
      transactions: [...updated.transactions]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 100),
    },
    trades,
  });
}
