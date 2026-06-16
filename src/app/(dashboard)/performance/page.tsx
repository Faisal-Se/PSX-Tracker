"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
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

/* Avatar tint palette (per ticker) — multi-series, never used for P&L. */
const TINTS = [
  "#2563EB",
  "#7C3AED",
  "#0D9488",
  "#DB2777",
  "#CA8A04",
  "#0891B2",
  "#16A34A",
  "#4F46E5",
];
function tint(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export default function PerformancePage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [modelPortfolios, setModelPortfolios] = useState<ModelPortfolio[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [marketData, setMarketData] = useState<MarketStock[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("1Y");
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

  // Max absolute P&L — scales the centered horizontal bars in "P&L by Stock".
  const maxAbsPnL = useMemo(
    () => stockPnL.reduce((m, s) => Math.max(m, Math.abs(s.pnl)), 0) || 1,
    [stockPnL]
  );

  const periods: Period[] = ["1W", "1M", "3M", "6M", "1Y", "ALL"];
  const scopes: { value: Scope; label: string }[] = [
    { value: "all", label: "All" },
    { value: "personal", label: "Personal" },
    { value: "models", label: "Models" },
  ];

  if (initialLoading) return <PageSkeleton />;

  const stats = [
    { label: "Net Worth", value: formatPKR(netWorth, { decimals: 0 }) },
    { label: "Invested", value: formatPKR(totalInvested, { decimals: 0 }) },
    { label: "Cash", value: formatPKR(totalCash, { decimals: 0 }) },
  ];

  const pnlUp = totalPnL >= 0;

  return (
    <>
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            Returns &amp; P&amp;L trends
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">Performance</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex gap-1 rounded-[11px] border border-line bg-canvas p-1">
            {scopes.map((s) => (
              <button
                key={s.value}
                onClick={() => setScope(s.value)}
                className={`rounded-lg px-3.5 py-[7px] text-[13px] font-semibold transition-colors ${
                  scope === s.value
                    ? "bg-brand text-white"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04] disabled:opacity-70"
          >
            <RefreshCw className={`h-[15px] w-[15px] ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="mb-[18px] grid grid-cols-2 gap-[18px] lg:grid-cols-4">
        {/* Total P&L — featured */}
        <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">Total P&amp;L</div>
          <div
            className="num text-[26px] font-bold tracking-[-.025em]"
            style={{ color: pnlUp ? "var(--color-gain)" : "var(--color-loss-strong)" }}
          >
            {pnlUp ? "+" : "−"}Rs {formatPKR(Math.abs(totalPnL), { decimals: 0 })}
          </div>
          <div
            className="num mt-1 text-[12px] font-semibold"
            style={{ color: pnlUp ? "var(--color-gain)" : "var(--color-loss-strong)" }}
          >
            {totalPnLPct >= 0 ? "+" : ""}
            {totalPnLPct.toFixed(2)}%
          </div>
        </div>

        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-line bg-card p-[22px] shadow-card"
          >
            <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">{s.label}</div>
            <div className="num text-[22px] font-bold tracking-[-.025em]">
              Rs {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Investment Timeline */}
      <section className="mb-[18px] rounded-2xl border border-line bg-card p-[22px] shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="text-[15px] font-bold">Investment Timeline</div>
          <div className="flex gap-1 rounded-[11px] bg-canvas p-1">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  period === p ? "bg-brand text-white" : "text-ink-2 hover:text-ink"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="-mx-1.5 -mb-1 mt-4 h-[260px]">
          {chartData.length < 2 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-ink-3">
                No transaction data yet. Start trading to see your timeline.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" hide />
                <YAxis domain={["dataMin", "dataMax"]} hide />
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
                  formatter={(v) => [`Rs ${formatPKR(Number(v), { decimals: 0 })}`, "Net Invested"]}
                />
                <Area
                  type="monotone"
                  dataKey="invested"
                  stroke="#059669"
                  strokeWidth={2.2}
                  fill="url(#timelineFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#059669" }}
                  isAnimationActive
                  animationDuration={1100}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* P&L by Stock + Stock Returns */}
      <div className="grid items-start gap-[18px] lg:grid-cols-[1.2fr_1fr]">
        {/* P&L by Stock — centered horizontal bars */}
        <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-4 text-[15px] font-bold">P&amp;L by Stock</div>
          {stockPnL.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-3">No holdings to display</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stockPnL.slice(0, 10).map((s) => {
                const up = s.pnl >= 0;
                const width = (Math.abs(s.pnl) / maxAbsPnL) * 50;
                return (
                  <div
                    key={s.symbol}
                    className="grid grid-cols-[60px_1fr_82px] items-center gap-2.5"
                  >
                    <span className="text-[12px] font-semibold">{s.symbol}</span>
                    <div className="relative flex h-[18px] justify-center">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                      <div
                        className="absolute top-[3px] h-3 rounded-[3px]"
                        style={{
                          width: `${width}%`,
                          background: up
                            ? "var(--color-gain)"
                            : "var(--color-loss-strong)",
                          left: up ? "50%" : undefined,
                          right: up ? undefined : "50%",
                        }}
                      />
                    </div>
                    <span
                      className="num text-right text-[11.5px] font-semibold"
                      style={{
                        color: up ? "var(--color-gain)" : "var(--color-loss-strong)",
                      }}
                    >
                      {up ? "+" : "−"}
                      {formatPKR(Math.abs(s.pnl), { decimals: 0 })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Stock Returns list */}
        <section className="rounded-2xl border border-line bg-card shadow-card">
          <div className="px-[22px] pb-2 pt-[22px] text-[15px] font-bold">Stock Returns</div>
          {stockPnL.length === 0 ? (
            <p className="border-t border-line-soft px-[22px] py-12 text-center text-sm text-ink-3">
              No holdings to display
            </p>
          ) : (
            stockPnL.map((s) => {
              const up = s.pnlPct >= 0;
              const c = tint(s.symbol);
              return (
                <div
                  key={s.symbol}
                  className="flex items-center gap-2.5 border-t border-line-soft px-[22px] py-2.5"
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] text-[9.24px] font-bold"
                    style={{ background: `${c}22`, color: c }}
                  >
                    {s.symbol.slice(0, 2)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">{s.symbol}</div>
                    <div className="num text-[11px] text-ink-3">
                      Rs {formatPKR(s.current, { decimals: 0 })}
                    </div>
                  </div>
                  <span
                    className="num text-[12.5px] font-semibold"
                    style={{
                      color: up ? "var(--color-gain)" : "var(--color-loss-strong)",
                    }}
                  >
                    {up ? "+" : "−"}
                    {Math.abs(s.pnlPct).toFixed(2)}%
                  </span>
                </div>
              );
            })
          )}
        </section>
      </div>
    </>
  );
}
