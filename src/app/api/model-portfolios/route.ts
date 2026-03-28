import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import {
  getModelPortfolios,
  createModelPortfolio,
  generateId,
  type ModelAllocationData,
  type ModelTransactionData,
} from "@/lib/gdrive";
import { getMarketWatch } from "@/lib/psx";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const models = await getModelPortfolios();

  // Add _count for compatibility
  const result = models.map((m) => ({
    ...m,
    _count: { transactions: m.transactions.length },
  }));

  return NextResponse.json(result);
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
    return NextResponse.json(
      { error: "Starting cash is required" },
      { status: 400 }
    );
  }

  if (!allocations || allocations.length === 0) {
    return NextResponse.json(
      { error: "At least one allocation is required" },
      { status: 400 }
    );
  }

  const totalPct = allocations.reduce(
    (sum: number, a: { percentage: number }) => sum + a.percentage,
    0
  );
  if (Math.abs(totalPct - 100) > 0.01) {
    return NextResponse.json(
      {
        error: `Allocations must sum to 100% (currently ${totalPct.toFixed(1)}%)`,
      },
      { status: 400 }
    );
  }

  // Fetch current market prices
  const stockAllocations = allocations.filter(
    (a: { symbol: string }) => a.symbol !== "CASH"
  );
  let priceMap = new Map<string, number>();

  if (stockAllocations.length > 0) {
    const marketData = await getMarketWatch();
    priceMap = new Map(marketData.map((s) => [s.symbol, s.current]));
  }

  const now = new Date().toISOString();
  const newAllocations: ModelAllocationData[] = [];
  const newTransactions: ModelTransactionData[] = [];
  let totalSpent = 0;

  // CASH_IN transaction
  newTransactions.push({
    id: generateId(),
    type: "CASH_IN",
    symbol: "CASH",
    companyName: "Initial Deposit",
    quantity: 0,
    price: 0,
    total: cashBalance,
    createdAt: now,
  });

  for (const alloc of allocations as {
    symbol: string;
    companyName: string;
    percentage: number;
    customPrice?: number;
  }[]) {
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

    const marketPrice = priceMap.get(alloc.symbol);
    const price =
      alloc.customPrice && alloc.customPrice > 0
        ? alloc.customPrice
        : marketPrice;
    if (!price || price <= 0) {
      return NextResponse.json(
        {
          error: `Cannot find price for ${alloc.symbol}. Set a custom price or try again.`,
        },
        { status: 400 }
      );
    }

    const allocatedAmount = (alloc.percentage / 100) * cashBalance;
    const shares = Math.floor(allocatedAmount / price);
    const cost = shares * price;

    newAllocations.push({
      id: generateId(),
      symbol: alloc.symbol,
      companyName: alloc.companyName,
      percentage: alloc.percentage,
      shares,
      avgPrice: shares > 0 ? price : 0,
      createdAt: now,
      updatedAt: now,
    });

    if (shares > 0) {
      newTransactions.push({
        id: generateId(),
        type: "BUY",
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        quantity: shares,
        price,
        total: cost,
        createdAt: now,
      });
    }

    totalSpent += cost;
  }

  const model = await createModelPortfolio({
    name,
    description: description || "",
    cashBalance: cashBalance - totalSpent,
    allocations: newAllocations,
    transactions: newTransactions,
  });

  return NextResponse.json(model);
}
