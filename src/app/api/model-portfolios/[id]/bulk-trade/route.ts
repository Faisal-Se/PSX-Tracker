import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import {
  getModelPortfolio,
  updateModelPortfolio,
  generateId,
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
  const { trades } = body as {
    trades: {
      symbol: string;
      companyName: string;
      type: "BUY" | "SELL";
      quantity: number;
      price?: number;
    }[];
  };

  if (!trades || trades.length === 0) {
    return NextResponse.json(
      { error: "At least one trade is required" },
      { status: 400 }
    );
  }

  const model = await getModelPortfolio(id);
  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const marketData = await getMarketWatch();
  const priceMap = new Map(marketData.map((s) => [s.symbol, s.current]));

  let totalBuyCost = 0;
  const resolvedTrades: {
    symbol: string;
    companyName: string;
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
    total: number;
  }[] = [];

  // Aggregate total sell quantity per symbol so two SELLs of the same stock
  // can't each pass validation against the original share count and oversell.
  const sellTotals = new Map<string, number>();

  for (const trade of trades) {
    if (
      (trade.type !== "BUY" && trade.type !== "SELL") ||
      !Number.isFinite(trade.quantity) ||
      trade.quantity <= 0
    ) {
      return NextResponse.json(
        { error: `Invalid trade for ${trade.symbol}` },
        { status: 400 }
      );
    }

    const price =
      trade.price && trade.price > 0
        ? trade.price
        : priceMap.get(trade.symbol) || 0;
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: `Cannot find price for ${trade.symbol}` },
        { status: 400 }
      );
    }

    const total = trade.quantity * price;

    if (trade.type === "SELL") {
      sellTotals.set(
        trade.symbol,
        (sellTotals.get(trade.symbol) || 0) + trade.quantity
      );
    } else {
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

  // Validate aggregate sells against current holdings.
  for (const [symbol, qty] of sellTotals) {
    const alloc = model.allocations.find((a) => a.symbol === symbol);
    if (!alloc || alloc.shares < qty) {
      return NextResponse.json(
        {
          error: `Insufficient shares for ${symbol}. Have ${alloc?.shares || 0}, trying to sell ${qty}`,
        },
        { status: 400 }
      );
    }
  }

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

  const now = new Date().toISOString();

  let updated;
  try {
    updated = await updateModelPortfolio(id, (m) => {
    // Re-check inside the atomic write (guards against concurrent cash changes).
    if (netCashNeeded > m.cashBalance + 0.01) {
      throw new Error("INSUFFICIENT_CASH");
    }
    for (const trade of resolvedTrades) {
      // Record transaction
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

      // Update allocation
      const existingIdx = m.allocations.findIndex(
        (a) => a.symbol === trade.symbol
      );

      if (trade.type === "BUY") {
        if (existingIdx >= 0) {
          const existing = m.allocations[existingIdx];
          const newShares = existing.shares + trade.quantity;
          const newAvg =
            (existing.avgPrice * existing.shares +
              trade.price * trade.quantity) /
            newShares;
          m.allocations[existingIdx] = {
            ...existing,
            shares: newShares,
            avgPrice: newAvg,
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
      } else {
        // SELL
        if (existingIdx >= 0) {
          const existing = m.allocations[existingIdx];
          const newShares = existing.shares - trade.quantity;
          if (newShares <= 0) {
            m.allocations.splice(existingIdx, 1);
          } else {
            m.allocations[existingIdx] = {
              ...existing,
              shares: newShares,
              updatedAt: now,
            };
          }
        }
      }
    }

    m.cashBalance -= netCashNeeded;

    // Recalculate allocation percentages from real resulting market values
    // (trades/shares/cash are unchanged above — this only refreshes the % display)
    let totalValue = m.cashBalance;
    for (const a of m.allocations) {
      if (a.symbol === "CASH") continue;
      totalValue += a.shares * (priceMap.get(a.symbol) || a.avgPrice);
    }
    if (totalValue > 0) {
      for (const a of m.allocations) {
        if (a.symbol === "CASH") {
          a.percentage = Math.round((m.cashBalance / totalValue) * 1000) / 10;
        } else {
          const price = priceMap.get(a.symbol) || a.avgPrice;
          a.percentage = Math.round(((a.shares * price) / totalValue) * 1000) / 10;
        }
      }
    }

    return m;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_CASH") {
      return NextResponse.json({ error: "Insufficient cash" }, { status: 400 });
    }
    throw err;
  }

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
    executed: resolvedTrades,
  });
}
