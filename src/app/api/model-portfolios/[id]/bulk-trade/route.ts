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
  const { trades } = body as {
    trades: {
      symbol: string;
      companyName: string;
      type: "BUY" | "SELL";
      quantity: number;
      price?: number; // optional custom price, else market price
    }[];
  };

  if (!trades || trades.length === 0) {
    return NextResponse.json(
      { error: "At least one trade is required" },
      { status: 400 }
    );
  }

  const model = await prisma.modelPortfolio.findFirst({
    where: { id, userId: user.id },
    include: { allocations: true },
  });

  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch market prices
  const marketData = await getMarketWatch();
  const priceMap = new Map(marketData.map((s) => [s.symbol, s.current]));

  // Validate all trades
  let totalBuyCost = 0;
  const resolvedTrades: {
    symbol: string;
    companyName: string;
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
    total: number;
  }[] = [];

  for (const trade of trades) {
    if (trade.quantity <= 0) {
      return NextResponse.json(
        { error: `Invalid quantity for ${trade.symbol}` },
        { status: 400 }
      );
    }

    const price =
      trade.price && trade.price > 0
        ? trade.price
        : priceMap.get(trade.symbol) || 0;
    if (price <= 0) {
      return NextResponse.json(
        { error: `Cannot find price for ${trade.symbol}` },
        { status: 400 }
      );
    }

    const total = trade.quantity * price;

    if (trade.type === "SELL") {
      const alloc = model.allocations.find((a) => a.symbol === trade.symbol);
      if (!alloc || alloc.shares < trade.quantity) {
        return NextResponse.json(
          {
            error: `Insufficient shares for ${trade.symbol}. Have ${alloc?.shares || 0}, trying to sell ${trade.quantity}`,
          },
          { status: 400 }
        );
      }
    }

    if (trade.type === "BUY") {
      totalBuyCost += total;
    }

    resolvedTrades.push({
      symbol: trade.symbol,
      companyName: trade.companyName,
      type: trade.type,
      quantity: trade.quantity,
      price,
      total,
    });
  }

  // Calculate net cash impact
  const totalSellProceeds = resolvedTrades
    .filter((t) => t.type === "SELL")
    .reduce((sum, t) => sum + t.total, 0);
  const netCashNeeded = totalBuyCost - totalSellProceeds;

  if (netCashNeeded > model.cashBalance) {
    return NextResponse.json(
      {
        error: `Insufficient cash. Need PKR ${netCashNeeded.toFixed(0)}, have PKR ${model.cashBalance.toFixed(0)}`,
      },
      { status: 400 }
    );
  }

  // Execute all trades atomically
  const updated = await prisma.$transaction(async (tx) => {
    for (const trade of resolvedTrades) {
      // Record transaction
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

      // Update allocation
      const existing = model.allocations.find(
        (a) => a.symbol === trade.symbol
      );

      if (trade.type === "BUY") {
        if (existing) {
          const newShares = existing.shares + trade.quantity;
          const newAvg =
            (existing.avgPrice * existing.shares +
              trade.price * trade.quantity) /
            newShares;
          await tx.modelAllocation.update({
            where: { id: existing.id },
            data: { shares: newShares, avgPrice: newAvg },
          });
        } else {
          await tx.modelAllocation.create({
            data: {
              symbol: trade.symbol,
              companyName: trade.companyName,
              percentage: 0,
              shares: trade.quantity,
              avgPrice: trade.price,
              modelPortfolioId: id,
            },
          });
        }
      } else {
        // SELL
        if (existing) {
          const newShares = existing.shares - trade.quantity;
          if (newShares <= 0) {
            await tx.modelAllocation.delete({ where: { id: existing.id } });
          } else {
            await tx.modelAllocation.update({
              where: { id: existing.id },
              data: { shares: newShares },
            });
          }
        }
      }
    }

    // Update cash balance
    return tx.modelPortfolio.update({
      where: { id },
      data: { cashBalance: model.cashBalance - netCashNeeded },
      include: {
        allocations: { orderBy: { percentage: "desc" } },
        transactions: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
  });

  return NextResponse.json({
    model: updated,
    executed: resolvedTrades,
  });
}
