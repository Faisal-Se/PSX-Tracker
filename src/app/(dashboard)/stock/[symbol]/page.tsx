"use client";

import { useEffect, useState, useCallback, use } from "react";
import { ChevronLeft, Star, ArrowRight } from "lucide-react";
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
import { sectorName } from "@/lib/sectors";

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

const TINTS = ["#2563EB", "#7C3AED", "#0D9488", "#DB2777", "#CA8A04", "#0891B2", "#16A34A", "#4F46E5"];
function tint(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
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
      <>
        <div className="mb-[18px] flex items-center gap-3.5">
          <div className="h-[52px] w-[52px] animate-pulse rounded-[10px] bg-line-soft" />
          <div className="space-y-2">
            <div className="h-6 w-32 animate-pulse rounded bg-line-soft" />
            <div className="h-4 w-44 animate-pulse rounded bg-line-soft" />
          </div>
        </div>
        <div className="h-[380px] animate-pulse rounded-2xl border border-line bg-card shadow-card" />
      </>
    );
  }

  const isGain = stock.change >= 0;
  const c = tint(stock.symbol);

  const stats: { label: string; value: number; isVolume?: boolean }[] = [
    { label: "Open", value: stock.open },
    { label: "Prev Close", value: stock.ldcp },
    { label: "Day High", value: stock.high },
    { label: "Day Low", value: stock.low },
    { label: "Volume", value: stock.volume, isVolume: true },
  ];

  return (
    <>
      {/* Back link */}
      <Link
        href="/market"
        className="mb-3.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
      >
        <ChevronLeft className="h-[15px] w-[15px]" />
        Back to Market
      </Link>

      {/* Header */}
      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span
            className="grid shrink-0 place-items-center rounded-[10px] font-bold"
            style={{
              width: 52,
              height: 52,
              fontSize: "17.16px",
              background: `${c}22`,
              color: c,
            }}
          >
            {stock.symbol.slice(0, 2)}
          </span>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[26px] font-bold tracking-[-.03em]">
                {stock.symbol}
              </h1>
              <span className="rounded-full bg-canvas px-2.5 py-[3px] text-[11px] font-semibold text-ink-2">
                {sectorName(stock.sector)}
              </span>
            </div>
            <div className="mt-0.5 text-[14px] text-ink-3">{stock.company}</div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={handleAddToWatchlist}
            className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04]"
          >
            <Star className="h-[15px] w-[15px]" />
            Watch
          </button>
          <button
            onClick={() => setShowTrade(true)}
            className="flex h-10 items-center gap-2 rounded-[11px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105"
          >
            <ArrowRight className="h-[15px] w-[15px]" />
            Trade
          </button>
        </div>
      </div>

      {/* Price hero + chart */}
      <section className="mb-[18px] rounded-2xl border border-line bg-card p-[22px] shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <div className="num text-[36px] font-bold tracking-[-.03em]">
              Rs {formatPKR(stock.current)}
            </div>
            <span
              className="num rounded-lg px-2.5 py-1 text-[13px] font-semibold"
              style={{
                color: isGain ? "var(--color-gain)" : "var(--color-loss-strong)",
                background: isGain
                  ? "var(--color-gain-50)"
                  : "var(--color-loss-50)",
              }}
            >
              {isGain ? "▲ +" : "▼ "}
              {stock.changePercent.toFixed(2)}%
            </span>
            <span
              className="num text-[13px] font-semibold"
              style={{
                color: isGain ? "var(--color-gain)" : "var(--color-loss-strong)",
              }}
            >
              {isGain ? "+" : ""}
              {stock.change.toFixed(2)} today
            </span>
          </div>
          <div className="flex gap-1 rounded-[11px] bg-canvas p-1">
            {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${
                  period === p ? "bg-brand text-white" : "text-ink-2 hover:text-ink"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="-mx-1.5 -mb-1 mt-[18px] h-[290px]">
          {filteredHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filteredHistory}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={isGain ? "var(--color-gain)" : "var(--color-loss-strong)"}
                      stopOpacity={0.26}
                    />
                    <stop
                      offset="100%"
                      stopColor={isGain ? "var(--color-gain)" : "var(--color-loss-strong)"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-line)"
                  strokeOpacity={0.6}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--color-ink-3)" }}
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
                  tick={{ fontSize: 11, fill: "var(--color-ink-3)" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v) => formatPKR(v, { compact: true, decimals: 0 })}
                />
                <Tooltip
                  cursor={{ stroke: "var(--color-line)", strokeWidth: 1 }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--color-ink)",
                    boxShadow: "var(--shadow-pop)",
                  }}
                  labelStyle={{ color: "var(--color-ink-3)", marginBottom: 2 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    `Rs ${Number(value).toFixed(2)}`,
                    "Close",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={isGain ? "var(--color-gain)" : "var(--color-loss-strong)"}
                  strokeWidth={2.2}
                  fill="url(#priceFill)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    fill: "var(--color-card)",
                    stroke: isGain ? "var(--color-gain)" : "var(--color-loss-strong)",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-line-soft" />
              <p className="text-sm text-ink-3">Loading chart data…</p>
            </div>
          )}
        </div>
      </section>

      {/* Stat cells */}
      <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-line bg-card px-[22px] py-3.5 shadow-card"
          >
            <div className="mb-1.5 text-[11.5px] font-medium text-ink-2">
              {stat.label}
            </div>
            <div className="num text-[17px] font-bold">
              {stat.isVolume
                ? formatPKR(stat.value, { compact: true })
                : formatPKR(stat.value, { decimals: 1 })}
            </div>
          </div>
        ))}
      </div>

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
    </>
  );
}
