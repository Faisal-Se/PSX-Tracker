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

  const updated = await updateModelPortfolio(id, (m) => {
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
    executed: resolvedTrades,
  });
}
