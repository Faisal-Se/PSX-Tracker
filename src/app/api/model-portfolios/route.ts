import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getMarketWatch } from "@/lib/psx";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const models = await prisma.modelPortfolio.findMany({
    where: { userId: user.id },
    include: {
      allocations: { orderBy: { percentage: "desc" } },
      _count: { select: { transactions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(models);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, cashBalance, allocations } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!cashBalance || cashBalance <= 0) {
    return NextResponse.json({ error: "Starting cash is required" }, { status: 400 });
  }

  if (!allocations || allocations.length === 0) {
    return NextResponse.json({ error: "At least one allocation is required" }, { status: 400 });
  }

  const totalPct = allocations.reduce(
    (sum: number, a: { percentage: number }) => sum + a.percentage,
    0
  );
  if (Math.abs(totalPct - 100) > 0.01) {
    return NextResponse.json(
      { error: `Allocations must sum to 100% (currently ${totalPct.toFixed(1)}%)` },
      { status: 400 }
    );
  }

  // Fetch current market prices for stock allocations
  const stockAllocations = allocations.filter(
    (a: { symbol: string }) => a.symbol !== "CASH"
  );
  let priceMap = new Map<string, number>();

  if (stockAllocations.length > 0) {
    const marketData = await getMarketWatch();
    priceMap = new Map(marketData.map((s) => [s.symbol, s.current]));
  }

  // Calculate purchases for each stock allocation
  const purchases: {
    symbol: string;
    companyName: string;
    percentage: number;
    shares: number;
    avgPrice: number;
    cost: number;
  }[] = [];
  let totalSpent = 0;

  for (const alloc of allocations as {
    symbol: string;
    companyName: string;
    percentage: number;
    customPrice?: number;
  }[]) {
    if (alloc.symbol === "CASH") {
      purchases.push({
        symbol: "CASH",
        companyName: "Cash Reserve",
        percentage: alloc.percentage,
        shares: 0,
        avgPrice: 0,
        cost: 0,
      });
      continue;
    }

    // Use custom price if provided, otherwise market price
    const marketPrice = priceMap.get(alloc.symbol);
    const price = alloc.customPrice && alloc.customPrice > 0 ? alloc.customPrice : marketPrice;
    if (!price || price <= 0) {
      return NextResponse.json(
        { error: `Cannot find price for ${alloc.symbol}. Set a custom price or try again.` },
        { status: 400 }
      );
    }

    const allocatedAmount = (alloc.percentage / 100) * cashBalance;
    const shares = Math.floor(allocatedAmount / price);
    const cost = shares * price;

    purchases.push({
      symbol: alloc.symbol,
      companyName: alloc.companyName,
      percentage: alloc.percentage,
      shares,
      avgPrice: shares > 0 ? price : 0,
      cost,
    });
    totalSpent += cost;
  }

  const remainingCash = cashBalance - totalSpent;

  // Create everything in a transaction
  const model = await prisma.$transaction(async (tx) => {
    const created = await tx.modelPortfolio.create({
      data: {
        name,
        description: description || "",
        cashBalance: remainingCash,
        userId: user.id,
      },
    });

    // Create allocations with shares
    await tx.modelAllocation.createMany({
      data: purchases.map((p) => ({
        symbol: p.symbol,
        companyName: p.companyName,
        percentage: p.percentage,
        shares: p.shares,
        avgPrice: p.avgPrice,
        modelPortfolioId: created.id,
      })),
    });

    // Record CASH_IN transaction
    await tx.modelTransaction.create({
      data: {
        type: "CASH_IN",
        symbol: "CASH",
        companyName: "Initial Deposit",
        quantity: 0,
        price: 0,
        total: cashBalance,
        modelPortfolioId: created.id,
      },
    });

    // Record BUY transactions for each stock purchased
    for (const p of purchases) {
      if (p.symbol === "CASH" || p.shares === 0) continue;
      await tx.modelTransaction.create({
        data: {
          type: "BUY",
          symbol: p.symbol,
          companyName: p.companyName,
          quantity: p.shares,
          price: p.avgPrice,
          total: p.cost,
          modelPortfolioId: created.id,
        },
      });
    }

    return tx.modelPortfolio.findUnique({
      where: { id: created.id },
      include: { allocations: { orderBy: { percentage: "desc" } } },
    });
  });

  return NextResponse.json(model);
}
