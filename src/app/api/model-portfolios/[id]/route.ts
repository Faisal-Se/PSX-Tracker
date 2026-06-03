import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import {
  getModelPortfolio,
  updateModelPortfolio,
  deleteModelPortfolio,
  generateId,
} from "@/lib/gdrive";
import { getMarketWatch } from "@/lib/psx";

// Recalculate allocation percentages based on actual market values
async function recalcPercentages(
  allocations: { symbol: string; shares: number; avgPrice: number; percentage: number }[],
  cashBalance: number
) {
  const marketData = await getMarketWatch();
  const priceMap = new Map(marketData.map((s) => [s.symbol, s.current]));

  let total = cashBalance;
  for (const a of allocations) {
    if (a.symbol === "CASH") continue;
    const price = priceMap.get(a.symbol) || a.avgPrice;
    total += a.shares * price;
  }

  if (total > 0) {
    for (const a of allocations) {
      if (a.symbol === "CASH") {
        a.percentage = Math.round((cashBalance / total) * 1000) / 10;
      } else {
        const price = priceMap.get(a.symbol) || a.avgPrice;
        a.percentage = Math.round(((a.shares * price) / total) * 1000) / 10;
      }
    }
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const model = await getModelPortfolio(id);

  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Recompute percentages live from current market values so they always
  // reflect the latest prices and holdings (stored percentages can go stale
  // after trades). Only the percentage field is derived — nothing is persisted.
  await recalcPercentages(model.allocations, model.cashBalance);

  // Sort allocations by percentage desc, transactions by date desc (take 100)
  const sorted = {
    ...model,
    allocations: [...model.allocations].sort(
      (a, b) => b.percentage - a.percentage
    ),
    transactions: [...model.transactions]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 100),
  };

  return NextResponse.json(sorted);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, description, addCash, withdrawCash, editHolding } = body;

  const now = new Date().toISOString();

  // Edit a holding's average price (and optionally shares) in place.
  // Does NOT touch cash or transactions — only corrects the stored cost basis.
  if (editHolding && editHolding.symbol) {
    const { symbol, avgPrice, shares } = editHolding as {
      symbol: string;
      avgPrice?: number;
      shares?: number;
    };
    if (symbol === "CASH") {
      return NextResponse.json(
        { error: "Cannot edit the cash allocation" },
        { status: 400 }
      );
    }
    if (avgPrice != null && (isNaN(avgPrice) || avgPrice < 0)) {
      return NextResponse.json(
        { error: "Average price must be a non-negative number" },
        { status: 400 }
      );
    }
    if (shares != null && (!Number.isInteger(shares) || shares < 0)) {
      return NextResponse.json(
        { error: "Shares must be a non-negative whole number" },
        { status: 400 }
      );
    }

    const existing = await getModelPortfolio(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!existing.allocations.some((a) => a.symbol === symbol)) {
      return NextResponse.json(
        { error: `Holding ${symbol} not found in this portfolio` },
        { status: 404 }
      );
    }

    const updated = await updateModelPortfolio(id, (m) => {
      const alloc = m.allocations.find((a) => a.symbol === symbol);
      if (alloc) {
        if (avgPrice != null) alloc.avgPrice = avgPrice;
        if (shares != null) alloc.shares = shares;
        alloc.updatedAt = now;
      }
      return m;
    });

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await recalcPercentages(updated.allocations, updated.cashBalance);

    return NextResponse.json({
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
    });
  }

  // Add cash flow
  if (addCash && addCash > 0) {
    const updated = await updateModelPortfolio(id, (m) => {
      m.cashBalance += addCash;
      m.transactions.push({
        id: generateId(),
        type: "CASH_IN",
        symbol: "CASH",
        companyName: "Cash Deposit",
        quantity: 0,
        price: 0,
        total: addCash,
        createdAt: now,
      });
      return m;
    });

    if (updated) {
      await recalcPercentages(updated.allocations, updated.cashBalance);
      await updateModelPortfolio(id, (m) => {
        m.allocations = updated.allocations;
        return m;
      });
    }

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
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
    });
  }

  // Withdraw cash flow
  if (withdrawCash && withdrawCash > 0) {
    const existing = await getModelPortfolio(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (withdrawCash > existing.cashBalance) {
      return NextResponse.json(
        {
          error: `Insufficient cash. Available: PKR ${existing.cashBalance.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    const updated = await updateModelPortfolio(id, (m) => {
      m.cashBalance -= withdrawCash;
      m.transactions.push({
        id: generateId(),
        type: "CASH_OUT",
        symbol: "CASH",
        companyName: "Cash Withdrawal",
        quantity: 0,
        price: 0,
        total: withdrawCash,
        createdAt: now,
      });
      return m;
    });

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await recalcPercentages(updated.allocations, updated.cashBalance);
    await updateModelPortfolio(id, (m) => {
      m.allocations = updated.allocations;
      return m;
    });

    return NextResponse.json({
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
    });
  }

  // Update name/description
  const updated = await updateModelPortfolio(id, (m) => {
    if (name !== undefined) m.name = name;
    if (description !== undefined) m.description = description;
    return m;
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
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
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteModelPortfolio(id);

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
