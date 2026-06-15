"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  BarChart3,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { formatPKR } from "@/lib/market-status";
import { PageSkeleton } from "@/components/ui/skeleton";

interface Transaction {
  id: string;
  type: string;
  symbol: string;
  companyName: string;
  quantity: number;
  price: number;
  total: number;
  createdAt: string;
  portfolioId: string;
}

interface Holding {
  symbol: string;
  companyName: string;
  quantity: number;
  avgPrice: number;
}

interface Portfolio {
  id: string;
  name: string;
  cashBalance: number;
  holdings: Holding[];
}

interface MarketStock {
  symbol: string;
  current: number;
}

interface ModelAllocation {
  symbol: string;
  companyName: string;
  percentage: number;
  shares: number;
  avgPrice: number;
}

interface ModelTransaction {
  id?: string;
  type: string;
  symbol: string;
  companyName: string;
  quantity: number;
  price: number;
  total: number;
  createdAt: string;
}

interface ModelPortfolio {
  id: string;
  name: string;
  cashBalance: number;
  allocations: ModelAllocation[];
  transactions?: ModelTransaction[];
}

type Period = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";
type Scope = "all" | "personal" | "models";

// Map a model portfolio into the page's Portfolio shape (excluding the CASH pseudo-row)
function modelToPortfolio(m: ModelPortfolio): Portfolio {
  return {
    id: m.id,
    name: m.name,
    cashBalance: m.cashBalance,
    holdings: m.allocations
      .filter((a) => a.symbol !== "CASH")
      .map((a) => ({
        symbol: a.symbol,
        companyName: a.companyName,
        quantity: a.shares,
        avgPrice: a.avgPrice,
      })),
  };
}

const chartTooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: "var(--popover-foreground)",
} as const;

export default function PerformancePage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [modelPortfolios, setModelPortfolios] = useState<ModelPortfolio[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [marketData, setMarketData] = useState<MarketStock[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("1M");
  const [scope, setScope] = useState<Scope>("all");
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [portfolioRes, modelRes, txRes, marketRes] = await Promise.all([
        fetch("/api/portfolios"),
        fetch("/api/model-portfolios"),
        fetch("/api/transactions"),
        fetch("/api/psx"),
      ]);

      if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
      if (modelRes.ok) {
        const data = await modelRes.json();
        setModelPortfolios(Array.isArray(data) ? data : []);
      }
      if (txRes.ok) setTransactions(await txRes.json());
      if (marketRes.ok) {
        const data = await marketRes.json();
        setMarketData(Array.isArray(data) ? data : []);
      }
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const priceMap = useMemo(
    () => new Map(marketData.map((s) => [s.symbol, s.current])),
    [marketData]
  );

  // Derived portfolios based on the selected scope
  const activePortfolios = useMemo<Portfolio[]>(() => {
    const mapped = modelPortfolios.map(modelToPortfolio);
    if (scope === "personal") return portfolios;
    if (scope === "models") return mapped;
    return [...portfolios, ...mapped];
  }, [scope, portfolios, modelPortfolios]);

  // Derived transactions based on the selected scope (models synthesize portfolioId)
  const activeTransactions = useMemo<Transaction[]>(() => {
    const modelTx: Transaction[] = modelPortfolios.flatMap((m) =>
      (m.transactions ?? []).map((t) => ({
        id: t.id ?? `${m.id}-${t.symbol}-${t.createdAt}`,
        type: t.type,
        symbol: t.symbol,
        companyName: t.companyName,
        quantity: t.quantity,
        price: t.price,
        total: t.total,
        createdAt: t.createdAt,
        portfolioId: m.id,
      }))
    );
    if (scope === "personal") return transactions;
    if (scope === "models") return modelTx;
    return [...transactions, ...modelTx];
  }, [scope, transactions, modelPortfolios]);

  // Calculate current portfolio metrics
  const totalInvested = activePortfolios.reduce(
    (sum, p) =>
      sum + p.holdings.reduce((hSum, h) => hSum + h.avgPrice * h.quantity, 0),
    0
  );
  const totalCurrentValue = activePortfolios.reduce(
    (sum, p) =>
      sum +
      p.holdings.reduce((hSum, h) => {
        const cp = priceMap.get(h.symbol) || h.avgPrice;
        return hSum + cp * h.quantity;
      }, 0),
    0
  );
  const totalCash = activePortfolios.reduce((sum, p) => sum + p.cashBalance, 0);
  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const netWorth = totalCurrentValue + totalCash;

  // Build cumulative P&L chart data from transactions
  const chartData = useMemo(() => {
    if (activeTransactions.length === 0) return [];

    const sorted = [...activeTransactions].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Group transactions by date
    const dailyMap = new Map<
      string,
      { invested: number; buys: number; sells: number }
    >();

    let cumulativeInvested = 0;
    let cumulativeSellProceeds = 0;

    for (const tx of sorted) {
      const dateKey = new Date(tx.createdAt).toISOString().split("T")[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { invested: 0, buys: 0, sells: 0 });
      }
      const day = dailyMap.get(dateKey)!;

      if (tx.type === "BUY") {
        cumulativeInvested += tx.total;
        day.buys += tx.total;
      } else if (tx.type === "SELL") {
        cumulativeSellProceeds += tx.total;
        day.sells += tx.total;
      }

      day.invested = cumulativeInvested - cumulativeSellProceeds;
    }

    // Filter by period
    const now = new Date();
    const cutoff = new Date();
    switch (period) {
      case "1W":
        cutoff.setDate(now.getDate() - 7);
        break;
      case "1M":
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case "3M":
        cutoff.setMonth(now.getMonth() - 3);
        break;
      case "6M":
        cutoff.setMonth(now.getMonth() - 6);
        break;
      case "1Y":
        cutoff.setFullYear(now.getFullYear() - 1);
        break;
      case "ALL":
        cutoff.setFullYear(2000);
        break;
    }

    return Array.from(dailyMap.entries())
      .filter(([date]) => new Date(date) >= cutoff)
      .map(([date, data]) => ({
        date,
        label: new Date(date).toLocaleDateString("en-PK", {
          day: "numeric",
          month: "short",
        }),
        invested: data.invested,
        buys: data.buys,
        sells: data.sells,
      }));
  }, [activeTransactions, period]);

  // Per-stock P&L breakdown
  const stockPnL = useMemo(() => {
    const allHoldings = activePortfolios.flatMap((p) => p.holdings);
    const grouped = new Map<
      string,
      { symbol: string; companyName: string; invested: number; current: number }
    >();

    for (const h of allHoldings) {
      const existing = grouped.get(h.symbol);
      const currentPrice = priceMap.get(h.symbol) || h.avgPrice;
      if (existing) {
        existing.invested += h.avgPrice * h.quantity;
        existing.current += currentPrice * h.quantity;
      } else {
        grouped.set(h.symbol, {
          symbol: h.symbol,
          companyName: h.companyName,
          invested: h.avgPrice * h.quantity,
          current: currentPrice * h.quantity,
        });
      }
    }

    return Array.from(grouped.values())
      .map((s) => ({
        ...s,
        pnl: s.current - s.invested,
        pnlPct: s.invested > 0 ? ((s.current - s.invested) / s.invested) * 100 : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [activePortfolios, priceMap]);

  const periods: Period[] = ["1W", "1M", "3M", "6M", "1Y", "ALL"];
  const scopes: { value: Scope; label: string }[] = [
    { value: "all", label: "All" },
    { value: "personal", label: "Personal" },
    { value: "models", label: "Models" },
  ];

  if (initialLoading) return <PageSkeleton />;

  const stats = [
    {
      label: "Net Worth",
      value: formatPKR(netWorth, { decimals: 0 }),
    },
    {
      label: "Invested",
      value: formatPKR(totalInvested, { decimals: 0 }),
    },
    {
      label: "Cash",
      value: formatPKR(totalCash, { decimals: 0 }),
    },
  ];

  return (
    <div className="space-y-6 lg:space-y-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-end justify-between animate-in-up">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Portfolio
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
            Performance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your portfolio returns and P&L over time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border border-border p-0.5">
            {scopes.map((s) => (
              <button
                key={s.value}
                onClick={() => setScope(s.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  scope === s.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={refreshing}
            className="h-8 text-xs gap-1.5 rounded-lg"
          >
            <RefreshCw
              className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Hero Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-xl border border-border bg-border animate-in-up-delay-1">
        {/* Total P&L — featured */}
        <div className="bg-card p-5 col-span-2 lg:col-span-1 flex flex-col justify-between">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Total P&amp;L
          </p>
          <div className="mt-2">
            <p
              className="text-2xl lg:text-3xl font-semibold font-tabular leading-none"
              style={{ color: totalPnL >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
            >
              {totalPnL >= 0 ? "+" : ""}
              {formatPKR(totalPnL, { decimals: 0 })}
            </p>
            <span
              className="inline-flex items-center gap-0.5 mt-2 px-1.5 py-0.5 rounded-md text-xs font-semibold font-tabular"
              style={{
                color: totalPnL >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                background: totalPnL >= 0 ? "var(--color-profit-bg)" : "var(--color-loss-bg)",
              }}
            >
              {totalPnL >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {totalPnLPct >= 0 ? "+" : ""}
              {totalPnLPct.toFixed(2)}%
            </span>
          </div>
        </div>

        {stats.map((s) => (
          <div key={s.label} className="bg-card p-5 flex flex-col justify-between">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {s.label}
            </p>
            <p className="text-xl lg:text-2xl font-semibold font-tabular mt-2 leading-none">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Investment Timeline Chart */}
      <Card className="border border-border bg-card rounded-xl animate-in-up-delay-2">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Investment Timeline
            </CardTitle>
            <div className="flex gap-1 rounded-lg border border-border p-0.5">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    period === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-center py-16">
              <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No transaction data yet. Start trading to see your timeline.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="investedGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    v >= 1000000
                      ? `${(v / 1000000).toFixed(1)}M`
                      : v >= 1000
                        ? `${(v / 1000).toFixed(0)}K`
                        : v.toString()
                  }
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  cursor={{ stroke: "var(--border)" }}
                  formatter={(value) => [
                    `PKR ${formatPKR(Number(value), { decimals: 0 })}`,
                    "Net Invested",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="invested"
                  stroke="var(--chart-1)"
                  fill="url(#investedGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Per-stock P&L Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in-up-delay-3">
        {/* P&L Bar Chart */}
        <Card className="border border-border bg-card rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              P&L by Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockPnL.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No holdings to display
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(250, stockPnL.length * 45)}>
                <BarChart
                  data={stockPnL.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 10, right: 10 }}
                >
                  <CartesianGrid
                    stroke="var(--border)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="symbol"
                    tick={{ fontSize: 11, fontWeight: 600, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    cursor={{ fill: "var(--border)", opacity: 0.3 }}
                    formatter={(value) => [
                      `PKR ${formatPKR(Number(value), { decimals: 0 })}`,
                      "P&L",
                    ]}
                  />
                  <Bar dataKey="pnl" radius={[0, 6, 6, 0]}>
                    {stockPnL.slice(0, 10).map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.pnl >= 0
                            ? "var(--color-profit)"
                            : "var(--color-loss)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* P&L List */}
        <Card className="border border-border bg-card rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Stock Returns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockPnL.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No holdings to display
              </p>
            ) : (
              <div className="divide-y divide-border">
                {stockPnL.map((stock) => (
                  <div
                    key={stock.symbol}
                    className="flex items-center justify-between py-2.5 px-1 transition-colors hover:bg-muted/40"
                  >
                    <div>
                      <p className="text-sm font-semibold">{stock.symbol}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Invested: PKR {formatPKR(stock.invested, { decimals: 0 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-sm font-semibold font-tabular flex items-center gap-0.5 justify-end"
                        style={{ color: stock.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
                      >
                        {stock.pnl >= 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5" />
                        )}
                        {stock.pnl >= 0 ? "+" : ""}
                        {formatPKR(stock.pnl, { decimals: 0 })}
                      </p>
                      <p
                        className="text-[11px] font-tabular font-semibold"
                        style={{ color: stock.pnlPct >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
                      >
                        {stock.pnlPct >= 0 ? "+" : ""}
                        {stock.pnlPct.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
