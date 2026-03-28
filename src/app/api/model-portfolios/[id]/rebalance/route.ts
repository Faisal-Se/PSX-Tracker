import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
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
    return NextResponse.json({ error: "Allocations are required" }, { status: 400 });
  }

  const totalPct = allocations.reduce((sum, a) => sum + a.percentage, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    return NextResponse.json(
      { error: `Allocations must sum to 100% (currently ${totalPct.toFixed(1)}%)` },
      { status: 400 }
    );
  }

  // Load current model
  const model = await prisma.modelPortfolio.findFirst({
    where: { id, userId: user.id },
    include: { allocations: true },
  });

  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch current market prices
  const marketData = await getMarketWatch();
  const priceMap = new Map(marketData.map((s) => [s.symbol, s.current]));

  // Calculate total portfolio value (cash + holdings at market price)
  let totalValue = model.cashBalance;
  for (const alloc of model.allocations) {
    if (alloc.symbol === "CASH") continue;
    const price = priceMap.get(alloc.symbol) || alloc.avgPrice;
    totalValue += alloc.shares * price;
  }

  // Build a map of current allocations
  const currentMap = new Map(
    model.allocations.map((a) => [a.symbol, a])
  );

  // Calculate trades needed
  const trades: {
    type: "BUY" | "SELL";
    symbol: string;
    companyName: string;
    quantity: number;
    price: number;
    total: number;
  }[] = [];

  const newAllocations: {
    symbol: string;
    companyName: string;
    percentage: number;
    shares: number;
    avgPrice: number;
  }[] = [];

  let cashDelta = 0; // positive = cash increases (sells), negative = cash decreases (buys)

  for (const alloc of allocations) {
    if (alloc.symbol === "CASH") {
      newAllocations.push({
        symbol: "CASH",
        companyName: "Cash Reserve",
        percentage: alloc.percentage,
        shares: 0,
        avgPrice: 0,
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
      // BUY more shares
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
      // Weighted average price
      const newAvgPrice =
        currentShares > 0
          ? (currentAvgPrice * currentShares + currentPrice * diff) / targetShares
          : currentPrice;
      newAllocations.push({
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        percentage: alloc.percentage,
        shares: targetShares,
        avgPrice: newAvgPrice,
      });
    } else if (diff < 0) {
      // SELL shares
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
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        percentage: alloc.percentage,
        shares: targetShares,
        avgPrice: currentAvgPrice, // avg price doesn't change on sell
      });
    } else {
      // No change in shares
      newAllocations.push({
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        percentage: alloc.percentage,
        shares: currentShares,
        avgPrice: currentAvgPrice,
      });
    }
  }

  // Sell all shares of stocks that were removed from allocations
  const newSymbols = new Set(allocations.map((a) => a.symbol));
  for (const existing of model.allocations) {
    if (existing.symbol === "CASH") continue;
    if (!newSymbols.has(existing.symbol) && existing.shares > 0) {
      const currentPrice = priceMap.get(existing.symbol) || existing.avgPrice;
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

  // Check if we have enough cash
  const newCashBalance = model.cashBalance + cashDelta;
  if (newCashBalance < -0.01) {
    return NextResponse.json(
      {
        error: `Insufficient cash. Need PKR ${Math.abs(cashDelta).toFixed(0)} more. Add cash first.`,
      },
      { status: 400 }
    );
  }

  // Execute everything in a transaction
  const updated = await prisma.$transaction(async (tx) => {
    // Delete old allocations
    await tx.modelAllocation.deleteMany({ where: { modelPortfolioId: id } });

    // Create new allocations
    await tx.modelAllocation.createMany({
      data: newAllocations.map((a) => ({
        symbol: a.symbol,
        companyName: a.companyName,
        percentage: a.percentage,
        shares: a.shares,
        avgPrice: a.avgPrice,
        modelPortfolioId: id,
      })),
    });

    // Record transactions
    for (const trade of trades) {
      await tx.modelTransaction.create({
        data: {
          type: trade.type,
          symbol: trade.symbol,
          companyName: trade.companyName,
          quantity: trade.quantity,
          price: trade.price,
          total: trade.total,
          modelPortfolioId: id,
        },
      });
    }

    // Update cash balance
    return tx.modelPortfolio.update({
      where: { id },
      data: { cashBalance: Math.max(0, newCashBalance) },
      include: {
        allocations: { orderBy: { percentage: "desc" } },
        transactions: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
  });

  return NextResponse.json({ model: updated, trades });
}
