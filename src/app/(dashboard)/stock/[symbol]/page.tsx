"use client";

import { useEffect, useState, useCallback, use } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  ShoppingCart,
  ArrowLeft,
  Activity,
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
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
  const changeColor = isGain ? "var(--color-profit)" : "var(--color-loss)";
  const changeBg = isGain ? "var(--color-profit-bg)" : "var(--color-loss-bg)";

  const stats: { label: string; value: number; isVolume?: boolean }[] = [
    { label: "Open", value: stock.open },
    { label: "Prev Close", value: stock.ldcp },
    { label: "High", value: stock.high },
    { label: "Low", value: stock.low },
    { label: "Volume", value: stock.volume, isVolume: true },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 animate-in-up">
        <Link href="/market">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-lg text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              {stock.symbol}
            </h1>
            <span className="text-xs text-muted-foreground border border-border rounded-md px-2 py-0.5">
              {stock.sector}
            </span>
          </div>
          <p className="text-muted-foreground text-sm truncate">
            {stock.company}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg border border-border"
            onClick={handleAddToWatchlist}
          >
            <Eye className="h-4 w-4 mr-2" />
            Watch
          </Button>
          <Button
            size="sm"
            className="rounded-lg"
            onClick={() => setShowTrade(true)}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Trade
          </Button>
        </div>
      </div>

      {/* Price Hero */}
      <Card className="border border-border bg-card rounded-xl animate-in-up-delay-1">
        <CardContent className="py-6">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Last Price
          </p>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2 mt-1.5">
            <p className="text-4xl font-semibold font-tabular tracking-tight">
              {formatPKR(stock.current)}
            </p>
            <div
              className="flex items-center gap-1.5 pb-1"
              style={{ color: changeColor }}
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
              <span
                className="text-xs font-semibold font-tabular ml-0.5 rounded-md px-2 py-0.5"
                style={{ color: changeColor, backgroundColor: changeBg }}
              >
                {isGain ? "+" : ""}
                {stock.changePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cells */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-in-up-delay-2">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="border border-border bg-card rounded-xl"
          >
            <CardContent className="py-3.5 px-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <p className="text-base font-semibold font-tabular mt-1">
                {stat.isVolume
                  ? stock.volume.toLocaleString()
                  : formatPKR(stat.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Price Chart */}
      <Card className="border border-border bg-card rounded-xl animate-in-up-delay-3">
        <CardContent className="py-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Price History
            </p>
            <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
              {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className={`text-xs h-7 px-3 rounded-md ${
                    period === p
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
          {filteredHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart
                data={filteredHistory}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--primary)"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeOpacity={0.6}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={32}
                  tickFormatter={(d) => {
                    const date = new Date(d);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v) => formatPKR(v, { compact: true, decimals: 0 })}
                />
                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                    padding: "6px 10px",
                    boxShadow: "none",
                    color: "var(--foreground)",
                  }}
                  labelStyle={{
                    color: "var(--muted-foreground)",
                    marginBottom: 2,
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    `PKR ${Number(value).toFixed(2)}`,
                    "Close",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#priceFill)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    fill: "var(--card)",
                    stroke: "var(--primary)",
                  }}
                />
              </AreaChart>
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
