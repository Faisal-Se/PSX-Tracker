"use client";

import { useEffect, useState, useCallback, use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  ShoppingCart,
  ArrowLeft,
  BarChart3,
  Activity,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TradeDialog } from "@/components/TradeDialog";
import { formatPKR } from "@/lib/market-status";

interface StockData {
  symbol: string;
  company: string;
  sector: string;
  open: number;
  high: number;
  low: number;
  current: number;
  change: number;
  changePercent: number;
  volume: number;
  ldcp: number;
}

interface HistoryEntry {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Portfolio {
  id: string;
  name: string;
  cashBalance: number;
}

export default function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = use(params);
  const [stock, setStock] = useState<StockData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [showTrade, setShowTrade] = useState(false);
  const [period, setPeriod] = useState<"1M" | "3M" | "6M" | "1Y" | "ALL">(
    "3M"
  );

  const fetchData = useCallback(async () => {
    const [marketRes, historyRes, portfolioRes] = await Promise.all([
      fetch("/api/psx"),
      fetch(`/api/psx/history?symbol=${encodeURIComponent(symbol)}`),
      fetch("/api/portfolios"),
    ]);

    if (marketRes.ok) {
      const data = await marketRes.json();
      if (Array.isArray(data)) {
        const found = data.find(
          (s: StockData) => s.symbol === decodeURIComponent(symbol)
        );
        if (found) setStock(found);
      }
    }
    if (historyRes.ok) setHistory(await historyRes.json());
    if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredHistory = (() => {
    if (history.length === 0) return [];
    const now = new Date();
    const cutoff = new Date();
    switch (period) {
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
        return history;
    }
    return history.filter((h) => new Date(h.date) >= cutoff);
  })();

  const handleAddToWatchlist = async () => {
    if (!stock) return;
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: stock.symbol,
        companyName: stock.company,
      }),
    });
  };

  if (!stock) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
        <p className="text-muted-foreground text-sm">Loading stock data...</p>
      </div>
    );
  }

  const isGain = stock.change >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/market">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{stock.symbol}</h1>
            <Badge
              variant="secondary"
              className="text-xs rounded-lg px-2.5 py-0.5"
            >
              {stock.sector}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{stock.company}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={handleAddToWatchlist}
          >
            <Eye className="h-4 w-4 mr-2" />
            Watch
          </Button>
          <Button
            size="sm"
            className="rounded-xl"
            onClick={() => setShowTrade(true)}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Trade
          </Button>
        </div>
      </div>

      {/* Price Card */}
      <Card className="rounded-xl shadow-sm border-border/50">
        <CardContent className="py-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-4xl font-bold font-tabular tracking-tight">
                PKR {formatPKR(stock.current)}
              </p>
              <div
                className={`flex items-center gap-1.5 mt-2 ${
                  isGain
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {isGain ? (
                  <ArrowUpRight className="h-5 w-5" />
                ) : (
                  <ArrowDownRight className="h-5 w-5" />
                )}
                <span className="font-semibold font-tabular text-lg">
                  {isGain ? "+" : ""}
                  {stock.change.toFixed(2)}
                </span>
                <Badge
                  variant="secondary"
                  className={`text-xs font-semibold font-tabular ml-1 rounded-md ${
                    isGain
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}
                >
                  {isGain ? "+" : ""}
                  {stock.changePercent.toFixed(2)}%
                </Badge>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-x-8 gap-y-3">
              {[
                { label: "Open", value: stock.open },
                { label: "Prev Close", value: stock.ldcp },
                { label: "High", value: stock.high },
                { label: "Low", value: stock.low },
                {
                  label: "Volume",
                  value: stock.volume,
                  isVolume: true,
                },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-sm font-semibold font-tabular mt-0.5">
                    {stat.isVolume
                      ? stock.volume.toLocaleString()
                      : formatPKR(stat.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Chart */}
      <Card className="rounded-xl shadow-sm border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Price History
            </CardTitle>
            <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg">
              {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? "default" : "ghost"}
                  size="sm"
                  className={`text-xs h-7 px-3 rounded-md ${
                    period === p
                      ? "shadow-sm"
                      : "hover:bg-background/60"
                  }`}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={filteredHistory}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  strokeOpacity={0.5}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(d) => {
                    const date = new Date(d);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatPKR(v, { compact: true, decimals: 0 })}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    `PKR ${Number(value).toFixed(2)}`,
                    "Close",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={isGain ? "#10b981" : "#ef4444"}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    fill: "var(--card)",
                    stroke: isGain ? "#10b981" : "#ef4444",
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-10 w-10 rounded-xl bg-muted animate-pulse mb-3" />
              <p className="text-sm text-muted-foreground">
                Loading chart data...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {showTrade && (
        <TradeDialog
          open={showTrade}
          onOpenChange={setShowTrade}
          symbol={stock.symbol}
          companyName={stock.company}
          currentPrice={stock.current}
          portfolios={portfolios}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
