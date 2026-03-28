import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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
    return NextResponse.json({ error: "Portfolio is required" }, { status: 400 });
  }

  if (!trades || trades.length === 0) {
    return NextResponse.json({ error: "No trades to import" }, { status: 400 });
  }

  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId: user.id },
    include: { holdings: true },
  });

  if (!portfolio) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  // Validate trades
  for (const trade of trades) {
    if (!trade.symbol || !trade.quantity || !trade.price) {
      return NextResponse.json(
        { error: `Invalid trade data for ${trade.symbol || "unknown"}` },
        { status: 400 }
      );
    }
    if (trade.type === "SELL") {
      const holding = portfolio.holdings.find((h) => h.symbol === trade.symbol);
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
      { error: `Insufficient cash. Need PKR ${Math.abs(netCash).toFixed(0)}, have PKR ${portfolio.cashBalance.toFixed(0)}` },
      { status: 400 }
    );
  }

  // Execute all trades
  const result = await prisma.$transaction(async (tx) => {
    for (const trade of trades) {
      const total = trade.quantity * trade.price;

      await tx.transaction.create({
        data: {
          type: trade.type,
          symbol: trade.symbol,
          companyName: trade.companyName,
          quantity: trade.quantity,
          price: trade.price,
          total,
          portfolioId,
        },
      });

      const existing = portfolio.holdings.find(
        (h) => h.symbol === trade.symbol
      );

      if (trade.type === "BUY") {
        if (existing) {
          const newQty = existing.quantity + trade.quantity;
          const newAvg =
            (existing.avgPrice * existing.quantity +
              trade.price * trade.quantity) /
            newQty;
          await tx.holding.update({
            where: { id: existing.id },
            data: { quantity: newQty, avgPrice: newAvg },
          });
          existing.quantity = newQty;
          existing.avgPrice = newAvg;
        } else {
          const created = await tx.holding.create({
            data: {
              symbol: trade.symbol,
              companyName: trade.companyName,
              quantity: trade.quantity,
              avgPrice: trade.price,
              portfolioId,
            },
          });
          portfolio.holdings.push(created);
        }
      } else {
        if (existing) {
          const newQty = existing.quantity - trade.quantity;
          if (newQty <= 0) {
            await tx.holding.delete({ where: { id: existing.id } });
          } else {
            await tx.holding.update({
              where: { id: existing.id },
              data: { quantity: newQty },
            });
          }
          existing.quantity = newQty;
        }
      }
    }

    return tx.portfolio.update({
      where: { id: portfolioId },
      data: { cashBalance: portfolio.cashBalance + netCash },
    });
  });

  return NextResponse.json({
    success: true,
    imported: trades.length,
    newCashBalance: result.cashBalance,
  });
}
