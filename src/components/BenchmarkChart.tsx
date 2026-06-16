"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  buildNavSeries,
  sliceRange,
  twrReturnPct,
  simpleReturnPct,
  indexReturnPct,
  type HoldingLike,
  type HistPt,
  type CashFlow,
} from "@/lib/returns";

const RANGES = ["1D", "1W", "1M", "3M", "1Y", "3Y", "5Y", "ALL"] as const;
const KSE_COLOR = "#f59e0b";
const PORT_COLOR = "var(--color-gain)";

/**
 * Portfolio vs KSE-100 — cumulative TWR (or Simple) return overlay, with a
 * period selector and an out/under-performed delta footer. Fetches KSE-100
 * history itself. Theme-aware.
 */
export function BenchmarkChart({
  holdings,
  cash,
  history,
  cashFlows = [],
}: {
  holdings: HoldingLike[];
  cash: number;
  history: Record<string, HistPt[]>;
  /** External cash flows (+deposit / −withdrawal) for flow-neutral TWR. */
  cashFlows?: CashFlow[];
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("1M");
  const [method, setMethod] = useState<"twr" | "simple">("twr");
  const [kse, setKse] = useState<HistPt[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/psx/history?symbol=KSE100")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: { date: string; close: number }[]) => {
        if (!cancelled && Array.isArray(d))
          setKse(d.filter((p) => p.close > 0).map((p) => ({ date: p.date, close: p.close })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fullNav = useMemo(
    () => buildNavSeries(holdings, cash, history),
    [holdings, cash, history]
  );

  const { data, portFinal, kseFinal } = useMemo(() => {
    const nav = sliceRange(fullNav, range);
    if (nav.length < 2) return { data: [], portFinal: 0, kseFinal: 0 };
    const dates = nav.map((p) => p.date);
    const port = method === "twr" ? twrReturnPct(nav, cashFlows) : simpleReturnPct(nav);
    const idx = indexReturnPct(kse, dates);
    const idxMap = new Map(idx.map((p) => [p.date, p.pct]));
    const merged = port.map((p) => ({
      date: p.date,
      portfolio: p.pct,
      kse: idxMap.get(p.date) ?? null,
    }));
    return {
      data: merged,
      portFinal: port[port.length - 1]?.pct ?? 0,
      kseFinal: idx[idx.length - 1]?.pct ?? 0,
    };
  }, [fullNav, range, method, kse, cashFlows]);

  const delta = portFinal - kseFinal;
  const outperformed = delta >= 0;

  return (
    <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-bold tracking-[-.02em]">Portfolio vs KSE-100</h2>
        <span className="rounded-md bg-[#f59e0b]/15 px-2 py-1 text-[12px] font-semibold text-[#d97706]">
          KSE100
        </span>
      </div>
      <p className="mb-3.5 text-[12px] text-ink-3">
        Cumulative {method === "twr" ? "time-weighted" : "simple"} return
      </p>

      {/* TWR / Simple toggle */}
      <div className="mb-4 inline-flex gap-1 rounded-[10px] bg-canvas p-1">
        <button
          onClick={() => setMethod("twr")}
          className={`rounded-lg px-3 py-1 text-[12px] font-semibold transition-colors ${
            method === "twr" ? "bg-[#f59e0b] text-white" : "text-ink-2 hover:text-ink"
          }`}
        >
          TWR %
        </button>
        <button
          onClick={() => setMethod("simple")}
          className={`rounded-lg px-3 py-1 text-[12px] font-semibold transition-colors ${
            method === "simple" ? "bg-card text-ink shadow-card" : "text-ink-2 hover:text-ink"
          }`}
        >
          Simple %
        </button>
      </div>

      {/* range pills */}
      <div className="mb-4 flex flex-wrap gap-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-lg px-3 py-1 text-[12px] font-semibold transition-colors ${
              range === r ? "bg-card text-ink shadow-card" : "text-ink-3 hover:text-ink"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {data.length < 2 ? (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-[13px] text-ink-3">Not enough history to compare yet</p>
        </div>
      ) : (
        <>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="benchPort" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-gain)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-gain)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                  }
                  tick={{ fill: "var(--color-ink-3)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={48}
                />
                <YAxis
                  width={40}
                  tickFormatter={(v) => `${v >= 0 ? "+" : ""}${Number(v).toFixed(0)}%`}
                  tick={{ fill: "var(--color-ink-3)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--color-ink)",
                    boxShadow: "var(--shadow-pop)",
                  }}
                  labelFormatter={(d) =>
                    new Date(String(d)).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })
                  }
                  formatter={(v, n) => [
                    v == null ? "—" : `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`,
                    n === "portfolio" ? "Portfolio" : "KSE100",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="portfolio"
                  stroke={PORT_COLOR}
                  strokeWidth={2.4}
                  fill="url(#benchPort)"
                  dot={false}
                  isAnimationActive
                  animationDuration={900}
                />
                <Area
                  type="monotone"
                  dataKey="kse"
                  stroke={KSE_COLOR}
                  strokeWidth={2.2}
                  fill="none"
                  dot={false}
                  connectNulls
                  isAnimationActive
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* legend */}
          <div className="mt-2 flex items-center gap-4 text-[12px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-gain)" }} />
              Portfolio
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KSE_COLOR }} />
              KSE100
            </span>
          </div>

          {/* delta footer */}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-ink-3">
                Portfolio
              </div>
              <div
                className="num mt-0.5 text-[18px] font-bold"
                style={{ color: portFinal >= 0 ? "var(--color-gain)" : "var(--color-loss-strong)" }}
              >
                {portFinal >= 0 ? "+" : ""}
                {portFinal.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-ink-3">
                KSE100
              </div>
              <div
                className="num mt-0.5 text-[18px] font-bold"
                style={{ color: kseFinal >= 0 ? "var(--color-gain)" : "var(--color-loss-strong)" }}
              >
                {kseFinal >= 0 ? "+" : ""}
                {kseFinal.toFixed(1)}%
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-[11px] font-semibold uppercase tracking-[.05em]"
                style={{ color: outperformed ? "var(--color-gain)" : "var(--color-loss-strong)" }}
              >
                {outperformed ? "Outperformed" : "Underperformed"}
              </div>
              <div
                className="num mt-0.5 text-[18px] font-bold"
                style={{ color: outperformed ? "var(--color-gain)" : "var(--color-loss-strong)" }}
              >
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(1)}%
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
