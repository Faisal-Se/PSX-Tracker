"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
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

type Period = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

export default function PerformancePage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [marketData, setMarketData] = useState<MarketStock[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("1M");
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [portfolioRes, txRes, marketRes] = await Promise.all([
        fetch("/api/portfolios"),
        fetch("/api/transactions"),
        fetch("/api/psx"),
      ]);

      if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
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

  // Calculate current portfolio metrics
  const totalInvested = portfolios.reduce(
    (sum, p) =>
      sum + p.holdings.reduce((hSum, h) => hSum + h.avgPrice * h.quantity, 0),
    0
  );
  const totalCurrentValue = portfolios.reduce(
    (sum, p) =>
      sum +
      p.holdings.reduce((hSum, h) => {
        const cp = priceMap.get(h.symbol) || h.avgPrice;
        return hSum + cp * h.quantity;
      }, 0),
    0
  );
  const totalCash = portfolios.reduce((sum, p) => sum + p.cashBalance, 0);
  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const netWorth = totalCurrentValue + totalCash;

  // Build cumulative P&L chart data from transactions
  const chartData = useMemo(() => {
    if (transactions.length === 0) return [];

    const sorted = [...transactions].sort(
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
  }, [transactions, period]);

  // Per-stock P&L breakdown
  const stockPnL = useMemo(() => {
    const allHoldings = portfolios.flatMap((p) => p.holdings);
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
  }, [portfolios, priceMap]);

  const periods: Period[] = ["1W", "1M", "3M", "6M", "1Y", "ALL"];

  if (initialLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 lg:space-y-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-end justify-between animate-in-up">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
            Performance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your portfolio returns and P&L over time
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={refreshing}
          className="h-8 text-xs gap-1.5 rounded-xl"
        >
          <RefreshCw
            className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in-up-delay-1">
        <Card className="stat-card stat-card-violet rounded-2xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Net Worth
            </p>
            <p className="text-xl lg:text-2xl font-bold font-tabular mt-1">
              {formatPKR(netWorth, { decimals: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="stat-card stat-card-blue rounded-2xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Invested
            </p>
            <p className="text-xl lg:text-2xl font-bold font-tabular mt-1">
              {formatPKR(totalInvested, { decimals: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card
          className={`stat-card rounded-2xl ${totalPnL >= 0 ? "stat-card-emerald" : "stat-card-rose"}`}
        >
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Total P&L
            </p>
            <p
              className={`text-xl lg:text-2xl font-bold font-tabular mt-1 ${totalPnL >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {totalPnL >= 0 ? "+" : ""}
              {formatPKR(totalPnL, { decimals: 0 })}
            </p>
            <p
              className={`text-xs font-tabular ${totalPnL >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {totalPnLPct >= 0 ? "+" : ""}
              {totalPnLPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
        <Card className="stat-card stat-card-emerald rounded-2xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Cash
            </p>
            <p className="text-xl lg:text-2xl font-bold font-tabular mt-1">
              {formatPKR(totalCash, { decimals: 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Investment Timeline Chart */}
      <Card className="rounded-2xl animate-in-up-delay-2">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-violet-500" />
              Investment Timeline
            </CardTitle>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    period === p
                      ? "bg-background text-foreground shadow-sm"
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
                      stopColor="hsl(262, 80%, 55%)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(262, 80%, 55%)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
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
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [
                    `PKR ${formatPKR(Number(value), { decimals: 0 })}`,
                    "Net Invested",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="invested"
                  stroke="hsl(262, 80%, 55%)"
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
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-violet-500" />
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
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="symbol"
                    tick={{ fontSize: 11, fontWeight: 600 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
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
                            ? "hsl(152, 75%, 40%)"
                            : "hsl(0, 85%, 60%)"
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
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              Stock Returns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockPnL.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No holdings to display
              </p>
            ) : (
              <div className="space-y-1">
                {stockPnL.map((stock) => (
                  <div
                    key={stock.symbol}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold">{stock.symbol}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Invested: PKR {formatPKR(stock.invested, { decimals: 0 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold font-tabular flex items-center gap-0.5 justify-end ${
                          stock.pnl >= 0 ? "text-emerald-600" : "text-red-500"
                        }`}
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
                        className={`text-[11px] font-tabular font-semibold ${
                          stock.pnlPct >= 0
                            ? "text-emerald-600"
                            : "text-red-500"
                        }`}
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
