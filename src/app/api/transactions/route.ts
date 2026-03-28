import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const portfolioId = searchParams.get("portfolioId");

  const where: Record<string, unknown> = {
    portfolio: { userId: user.id },
  };
  if (portfolioId) {
    where.portfolioId = portfolioId;
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(transactions);
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

  // Verify portfolio belongs to user
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId: user.id },
  });

  if (!portfolio) {
    return NextResponse.json(
      { error: "Portfolio not found" },
      { status: 404 }
    );
  }

  const total = quantity * price;

  if (type === "BUY") {
    if (portfolio.cashBalance < total) {
      return NextResponse.json(
        { error: "Insufficient cash balance" },
        { status: 400 }
      );
    }

    // Update cash balance
    await prisma.portfolio.update({
      where: { id: portfolioId },
      data: { cashBalance: portfolio.cashBalance - total },
    });

    // Update or create holding
    const existingHolding = await prisma.holding.findUnique({
      where: { portfolioId_symbol: { portfolioId, symbol } },
    });

    if (existingHolding) {
      const newQuantity = existingHolding.quantity + quantity;
      const newAvgPrice =
        (existingHolding.avgPrice * existingHolding.quantity +
          price * quantity) /
        newQuantity;

      await prisma.holding.update({
        where: { id: existingHolding.id },
        data: { quantity: newQuantity, avgPrice: newAvgPrice },
      });
    } else {
      await prisma.holding.create({
        data: {
          symbol,
          companyName: companyName || symbol,
          quantity,
          avgPrice: price,
          portfolioId,
        },
      });
    }
  } else if (type === "SELL") {
    const existingHolding = await prisma.holding.findUnique({
      where: { portfolioId_symbol: { portfolioId, symbol } },
    });

    if (!existingHolding || existingHolding.quantity < quantity) {
      return NextResponse.json(
        { error: "Insufficient shares to sell" },
        { status: 400 }
      );
    }

    // Update cash balance
    await prisma.portfolio.update({
      where: { id: portfolioId },
      data: { cashBalance: portfolio.cashBalance + total },
    });

    // Update holding
    const newQuantity = existingHolding.quantity - quantity;
    if (newQuantity === 0) {
      await prisma.holding.delete({ where: { id: existingHolding.id } });
    } else {
      await prisma.holding.update({
        where: { id: existingHolding.id },
        data: { quantity: newQuantity },
      });
    }
  }

  // Create transaction record
  const transaction = await prisma.transaction.create({
    data: {
      type,
      symbol,
      companyName: companyName || symbol,
      quantity,
      price,
      total,
      portfolioId,
    },
  });

  return NextResponse.json(transaction);
}
