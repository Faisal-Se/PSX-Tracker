"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Download } from "lucide-react";
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { formatPKR } from "@/lib/market-status";
import { PageSkeleton } from "@/components/ui/skeleton";
import { sectorName } from "@/lib/sectors";

/* ────────────────────────── types ────────────────────────── */

interface Holding {
  id: string;
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
  sector: string;
  current: number;
}

interface ModelAllocation {
  symbol: string;
  companyName: string;
  percentage: number;
  shares: number;
  avgPrice: number;
}

interface ModelPortfolio {
  id: string;
  name: string;
  cashBalance: number;
  allocations: ModelAllocation[];
}

type Scope = "all" | "personal" | "models";

/* ────────────────────────── helpers ────────────────────────── */

// Map a model portfolio into the page's Portfolio shape (excluding the CASH pseudo-row)
function modelToPortfolio(m: ModelPortfolio): Portfolio {
  return {
    id: m.id,
    name: m.name,
    cashBalance: m.cashBalance,
    holdings: m.allocations
      .filter((a) => a.symbol !== "CASH")
      .map((a) => ({
        id: `${m.id}-${a.symbol}`,
        symbol: a.symbol,
        companyName: a.companyName,
        quantity: a.shares,
        avgPrice: a.avgPrice,
      })),
  };
}

// Allocation/donut palette (NOT used for P&L). Cash gets its own grey.
const ALLOC_COLORS = ["#7C3AED", "#0D9488", "#2563EB", "#0891B2", "#CA8A04", "#DB2777"];
const STOCKS_COLOR = "#2563EB";
const CASH_COLOR = "#CBD5E1";

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-line)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--color-ink)",
  boxShadow: "var(--shadow-pop)",
} as const;

/* ────────────────────────── page ────────────────────────── */

export default function AnalyticsPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [modelPortfolios, setModelPortfolios] = useState<ModelPortfolio[]>([]);
  const [marketData, setMarketData] = useState<MarketStock[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [portfolioRes, modelRes, marketRes] = await Promise.all([
        fetch("/api/portfolios"),
        fetch("/api/model-portfolios"),
        fetch("/api/psx"),
      ]);

      if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
      if (modelRes.ok) {
        const data = await modelRes.json();
        setModelPortfolios(Array.isArray(data) ? data : []);
      }
      if (marketRes.ok) {
        const data = await marketRes.json();
        setMarketData(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived portfolios based on the selected scope
  const activePortfolios = useMemo<Portfolio[]>(() => {
    const mapped = modelPortfolios.map(modelToPortfolio);
    if (scope === "personal") return portfolios;
    if (scope === "models") return mapped;
    return [...portfolios, ...mapped];
  }, [scope, portfolios, modelPortfolios]);

  const scopes: { value: Scope; label: string }[] = [
    { value: "all", label: "All" },
    { value: "personal", label: "Personal" },
    { value: "models", label: "Models" },
  ];

  const priceMap = useMemo(
    () => new Map(marketData.map((s) => [s.symbol, s.current])),
    [marketData]
  );
  const sectorMap = useMemo(
    () => new Map(marketData.map((s) => [s.symbol, s.sector])),
    [marketData]
  );

  const allHoldings = useMemo(
    () => activePortfolios.flatMap((p) => p.holdings),
    [activePortfolios]
  );

  // Portfolio totals
  const totalInvested = allHoldings.reduce(
    (sum, h) => sum + h.avgPrice * h.quantity,
    0
  );
  const totalCurrent = allHoldings.reduce((sum, h) => {
    const price = priceMap.get(h.symbol) || h.avgPrice;
    return sum + price * h.quantity;
  }, 0);
  const totalCash = activePortfolios.reduce((sum, p) => sum + p.cashBalance, 0);
  const totalPnL = totalCurrent - totalInvested;
  const totalValue = totalCurrent + totalCash;

  // Asset allocation (stocks vs cash)
  const assetAllocation = useMemo(
    () => [
      { name: "Stocks", value: Math.round(totalCurrent), color: STOCKS_COLOR },
      { name: "Cash", value: Math.round(totalCash), color: CASH_COLOR },
    ],
    [totalCurrent, totalCash]
  );
  const assetTotal = totalCurrent + totalCash || 1;

  // Sector allocation (by value), labelled via sectorName(code)
  const sectorData = useMemo(() => {
    const byCode = new Map<string, number>();
    allHoldings.forEach((h) => {
      const currentPrice = priceMap.get(h.symbol) || h.avgPrice;
      const value = currentPrice * h.quantity;
      const code = sectorMap.get(h.symbol) || "Other";
      byCode.set(code, (byCode.get(code) || 0) + value);
    });
    return Array.from(byCode.entries())
      .map(([code, value]) => ({ name: sectorName(code), value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [allHoldings, priceMap, sectorMap]);
  const sectorTotal = sectorData.reduce((s, x) => s + x.value, 0) || 1;

  // P&L per stock
  const pnlData = useMemo(
    () =>
      allHoldings
        .map((h) => {
          const currentPrice = priceMap.get(h.symbol) || h.avgPrice;
          const pnl = (currentPrice - h.avgPrice) * h.quantity;
          return {
            symbol: h.symbol,
            pnl: Math.round(pnl),
            pnlPercent:
              h.avgPrice > 0
                ? ((currentPrice - h.avgPrice) / h.avgPrice) * 100
                : 0,
          };
        })
        .sort((a, b) => b.pnl - a.pnl),
    [allHoldings, priceMap]
  );

  // Holdings breakdown rows (by weight)
  const breakdownRows = useMemo(() => {
    return allHoldings
      .map((h) => {
        const currentPrice = priceMap.get(h.symbol) || h.avgPrice;
        const value = currentPrice * h.quantity;
        const weight = totalCurrent > 0 ? (value / totalCurrent) * 100 : 0;
        const pnlPercent =
          h.avgPrice > 0
            ? ((currentPrice - h.avgPrice) / h.avgPrice) * 100
            : 0;
        return { symbol: h.symbol, value, weight, pnlPercent };
      })
      .sort((a, b) => b.value - a.value);
  }, [allHoldings, priceMap, totalCurrent]);
  const maxWeight = breakdownRows[0]?.weight || 1;

  const hasData = allHoldings.length > 0;

  if (!loaded) return <PageSkeleton />;

  return (
    <>
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            Allocations, sectors &amp; exports
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">Analytics</h1>
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
            onClick={() => window.open("/api/export?type=portfolios&format=csv")}
            className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3 text-[12.5px] font-medium shadow-card hover:bg-ink/[.04]"
          >
            <Download className="h-[14px] w-[14px]" />
            Holdings
          </button>
          <button
            onClick={() => window.open("/api/export?type=model-portfolios&format=csv")}
            className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3 text-[12.5px] font-medium shadow-card hover:bg-ink/[.04]"
          >
            <Download className="h-[14px] w-[14px]" />
            Models
          </button>
          <button
            onClick={() => window.open("/api/export?type=transactions&format=csv")}
            className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3 text-[12.5px] font-medium shadow-card hover:bg-ink/[.04]"
          >
            <Download className="h-[14px] w-[14px]" />
            Transactions
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-line bg-card p-[22px] py-16 text-center shadow-card">
          <p className="text-sm font-medium text-ink-2">
            No holdings data to analyze yet
          </p>
          <p className="mt-1 text-xs text-ink-3">
            Start trading from the Market page to see analytics here
          </p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="mb-[18px] grid grid-cols-2 gap-[18px] lg:grid-cols-4">
            <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
              <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">
                Total Portfolio
              </div>
              <div className="num text-[22px] font-bold tracking-[-.025em]">
                Rs {formatPKR(totalValue, { decimals: 0 })}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
              <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">
                Invested
              </div>
              <div className="num text-[22px] font-bold tracking-[-.025em]">
                Rs {formatPKR(totalInvested, { decimals: 0 })}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
              <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">
                Total P&amp;L
              </div>
              <div
                className="num text-[22px] font-bold tracking-[-.025em]"
                style={{
                  color: totalPnL >= 0 ? "var(--color-gain)" : "var(--color-loss-strong)",
                }}
              >
                {totalPnL >= 0 ? "+" : "−"}Rs {formatPKR(Math.abs(totalPnL), { decimals: 0 })}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
              <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">
                Holdings
              </div>
              <div className="num text-[22px] font-bold tracking-[-.025em]">
                {allHoldings.length}
              </div>
            </div>
          </div>

          {/* Allocation donuts */}
          <div className="mb-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
            {/* Asset Allocation */}
            <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
              <div className="mb-4 text-[15px] font-bold">Asset Allocation</div>
              <div className="flex items-center gap-5">
                <div className="relative h-[130px] w-[130px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={assetAllocation}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="63%"
                        outerRadius="100%"
                        paddingAngle={1.5}
                        stroke="none"
                        isAnimationActive
                        animationDuration={900}
                      >
                        {assetAllocation.map((e) => (
                          <Cell key={e.name} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v, n) => [
                          `Rs ${formatPKR(Number(v), { decimals: 0 })}`,
                          String(n),
                        ]}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <div className="text-[11px] text-ink-3">Total</div>
                      <div className="num text-[14px] font-bold">
                        {formatPKR(assetTotal, { compact: true })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {assetAllocation.map((e) => (
                    <div key={e.name} className="flex items-center gap-2">
                      <span
                        className="h-[9px] w-[9px] rounded-[3px]"
                        style={{ background: e.color }}
                      />
                      <span className="flex-1 text-[12px] font-medium">{e.name}</span>
                      <span className="num text-[12px] font-semibold text-ink-2">
                        {((e.value / assetTotal) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Sector Allocation */}
            <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
              <div className="mb-4 text-[15px] font-bold">Sector Allocation</div>
              <div className="flex items-center gap-5">
                <div className="relative h-[130px] w-[130px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={sectorData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="63%"
                        outerRadius="100%"
                        paddingAngle={1.5}
                        stroke="none"
                        isAnimationActive
                        animationDuration={900}
                      >
                        {sectorData.map((e, i) => (
                          <Cell
                            key={e.name}
                            fill={ALLOC_COLORS[i % ALLOC_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v, n) => [
                          `Rs ${formatPKR(Number(v), { decimals: 0 })}`,
                          String(n),
                        ]}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <div className="text-[11px] text-ink-3">Total</div>
                      <div className="num text-[14px] font-bold">
                        {formatPKR(sectorTotal, { compact: true })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {sectorData.slice(0, 6).map((e, i) => (
                    <div key={e.name} className="flex items-center gap-2">
                      <span
                        className="h-[9px] w-[9px] rounded-[3px]"
                        style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
                      />
                      <span className="flex-1 text-[12px] font-medium">{e.name}</span>
                      <span className="num text-[12px] font-semibold text-ink-2">
                        {((e.value / sectorTotal) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* P&L per Stock */}
          <section className="mb-[18px] rounded-2xl border border-line bg-card p-[22px] shadow-card">
            <div className="mb-3.5 text-[15px] font-bold">Profit &amp; Loss by Stock</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pnlData}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis
                  dataKey="symbol"
                  tick={{ fontSize: 11, fill: "var(--color-ink-3)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-ink-3)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatPKR(v, { compact: true, decimals: 0 })}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--color-line)", opacity: 0.3 }}
                  formatter={(v) => [
                    `Rs ${formatPKR(Number(v), { decimals: 0 })}`,
                    "P&L",
                  ]}
                />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                  {pnlData.map((entry) => (
                    <Cell
                      key={entry.symbol}
                      fill={
                        entry.pnl >= 0
                          ? "var(--color-gain)"
                          : "var(--color-loss-strong)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Holdings Breakdown */}
          <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
            <div className="mb-3.5 text-[15px] font-bold">Holdings Breakdown</div>
            <div className="flex flex-col gap-3">
              {breakdownRows.map((r, i) => {
                const c = ALLOC_COLORS[i % ALLOC_COLORS.length];
                const up = r.pnlPercent >= 0;
                return (
                  <div
                    key={r.symbol}
                    className="grid grid-cols-[80px_1fr_60px_70px] items-center gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-[9px] w-[9px] rounded-[3px]"
                        style={{ background: c }}
                      />
                      <span className="text-[12.5px] font-semibold">{r.symbol}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-canvas">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min((r.weight / maxWeight) * 100, 100)}%`,
                          background: c,
                        }}
                      />
                    </div>
                    <span className="num text-right text-[12px] font-semibold">
                      {r.weight.toFixed(1)}%
                    </span>
                    <span
                      className="num text-right text-[12px] font-semibold"
                      style={{
                        color: up ? "var(--color-gain)" : "var(--color-loss-strong)",
                      }}
                    >
                      {up ? "+" : "−"}
                      {Math.abs(r.pnlPercent).toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </>
  );
}
