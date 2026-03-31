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
  const { allocations, customPrices = {} } = body as {
    allocations: { symbol: string; companyName: string; percentage: number; exactShares?: number }[];
    customPrices?: Record<string, number>;
  };

  if (!allocations || allocations.length === 0) {
    return NextResponse.json(
      { error: "Allocations are required" },
      { status: 400 }
    );
  }

  const totalPct = allocations.reduce((sum, a) => sum + a.percentage, 0);
  // Use 1% tolerance to allow for rounding in shares mode
  if (Math.abs(totalPct - 100) > 1) {
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

  const existingCash = currentMap.get("CASH");

  for (const alloc of allocations) {
    if (alloc.symbol === "CASH") {
      // Preserve existing CASH allocation ID; percentage updated after trades are computed
      newAllocations.push({
        id: existingCash?.id || generateId(),
        symbol: "CASH",
        companyName: "Cash Reserve",
        percentage: alloc.percentage, // updated below after cashDelta is known
        shares: 0,
        avgPrice: 0,
        createdAt: existingCash?.createdAt || now,
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

    // Use exact shares if provided, otherwise calculate from percentage
    const targetShares = alloc.exactShares != null && alloc.exactShares >= 0
      ? alloc.exactShares
      : Math.floor(((alloc.percentage / 100) * totalValue) / currentPrice);
    const existing = currentMap.get(alloc.symbol);
    const currentShares = existing?.shares || 0;
    const currentAvgPrice = existing?.avgPrice || 0;
    const diff = targetShares - currentShares;

    if (diff > 0) {
      const buyPrice = customPrices[alloc.symbol] && customPrices[alloc.symbol] > 0
        ? customPrices[alloc.symbol]
        : currentPrice;
      const cost = diff * buyPrice;
      cashDelta -= cost;
      trades.push({
        type: "BUY",
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        quantity: diff,
        price: buyPrice,
        total: cost,
      });
      const newAvgPrice =
        currentShares > 0
          ? (currentAvgPrice * currentShares + buyPrice * diff) /
            targetShares
          : buyPrice;
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
      const sellPrice = customPrices[alloc.symbol] && customPrices[alloc.symbol] > 0
        ? customPrices[alloc.symbol]
        : currentPrice;
      const proceeds = sellQty * sellPrice;
      cashDelta += proceeds;
      trades.push({
        type: "SELL",
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        quantity: sellQty,
        price: sellPrice,
        total: proceeds,
      });
      newAllocations.push({
        id: existing?.id || generateId(),
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        percentage: alloc.percentage,
        shares: targetShares,
        avgPrice: targetShares > 0 ? currentAvgPrice : 0,
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
      const sellPrice = customPrices[existing.symbol] && customPrices[existing.symbol] > 0
        ? customPrices[existing.symbol]
        : priceMap.get(existing.symbol) || existing.avgPrice;
      const proceeds = existing.shares * sellPrice;
      cashDelta += proceeds;
      trades.push({
        type: "SELL",
        symbol: existing.symbol,
        companyName: existing.companyName,
        quantity: existing.shares,
        price: sellPrice,
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

  // Recalculate actual percentages based on real resulting values
  const actualCash = Math.max(0, newCashBalance);
  let actualTotalValue = actualCash;
  for (const a of newAllocations) {
    if (a.symbol === "CASH") continue;
    actualTotalValue += a.shares * (priceMap.get(a.symbol) || a.avgPrice);
  }
  if (actualTotalValue > 0) {
    for (const a of newAllocations) {
      if (a.symbol === "CASH") {
        a.percentage = Math.round((actualCash / actualTotalValue) * 1000) / 10;
      } else {
        const price = priceMap.get(a.symbol) || a.avgPrice;
        a.percentage = Math.round(((a.shares * price) / actualTotalValue) * 1000) / 10;
      }
    }
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
