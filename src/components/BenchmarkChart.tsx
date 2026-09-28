"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  simpleReturnPct,
  indexReturnPct,
  availableRanges,
  effectiveRange,
  percentAxisFormatter,
  type HoldingLike,
  type HistPt,
} from "@/lib/returns";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { fetchHistory } from "@/lib/history-client";

const RANGES = ["1D", "1W", "1M", "3M", "1Y", "3Y", "5Y", "ALL"] as const;
const BENCH_COLOR = "#f59e0b";
const PORT_COLOR = "var(--color-gain)";

/** Selectable benchmark indices (recorded alongside the user's stocks). */
const INDICES = [
  { code: "KSE100", label: "KSE-100" },
  { code: "KMI30", label: "KMI-30" },
] as const;
type IndexCode = (typeof INDICES)[number]["code"];

/**
 * Portfolio vs a PSX index — cumulative simple-return overlay, with a
 * switchable benchmark (KSE-100 / KMI-30), a period selector, and an
 * out/under-performed delta footer. Fetches index history itself (cached per
 * index). Theme-aware.
 */
export function BenchmarkChart({
  holdings,
  cash,
  history,
}: {
  holdings: HoldingLike[];
  cash: number;
  history: Record<string, HistPt[]>;
}) {
  const [selected, setRange] = useState<(typeof RANGES)[number]>("1M");
  const [benchmark, setBenchmark] = useState<IndexCode>("KSE100");
  const [indexHist, setIndexHist] = useState<Record<string, HistPt[]>>({});
  const cache = useRef<Record<string, HistPt[]>>({});

  const benchLabel = INDICES.find((i) => i.code === benchmark)?.label ?? benchmark;
  const bench = useMemo(() => indexHist[benchmark] ?? [], [indexHist, benchmark]);

  useEffect(() => {
    if (cache.current[benchmark]) {
      setIndexHist((h) => ({ ...h, [benchmark]: cache.current[benchmark] }));
      return;
    }
    let cancelled = false;
    fetchHistory([benchmark]).then((map) => {
      if (cancelled) return;
      const clean = map[benchmark]
        .filter((p) => p.close > 0)
        .map((p) => ({ date: p.date, close: p.close }));
      cache.current[benchmark] = clean;
      setIndexHist((h) => ({ ...h, [benchmark]: clean }));
    });
    return () => {
      cancelled = true;
    };
  }, [benchmark]);

  // Compare only over days the index has a price for. There is no year-ago
  // figure for an index, so an older portfolio point would be measured
  // against an index that appears not to have moved.
  const fullNav = useMemo(() => {
    const nav = buildNavSeries(holdings, cash, history);
    const indexStart = bench.length > 0 ? bench[0].date : null;
    return indexStart ? nav.filter((p) => p.date >= indexStart) : nav;
  }, [holdings, cash, history, bench]);
  const available = useMemo(() => availableRanges(fullNav, RANGES), [fullNav]);
  const range = effectiveRange(selected, RANGES, available);

  const { data, portFinal, benchFinal } = useMemo(() => {
    const nav = sliceRange(fullNav, range);
    if (nav.length < 2) return { data: [], portFinal: 0, benchFinal: 0 };
    const dates = nav.map((p) => p.date);
    const port = simpleReturnPct(nav);
    const idx = indexReturnPct(bench, dates);
    const idxMap = new Map(idx.map((p) => [p.date, p.pct]));
    const merged = port.map((p) => ({
      date: p.date,
      portfolio: p.pct,
      bench: idxMap.get(p.date) ?? null,
    }));
    return {
      data: merged,
      portFinal: port[port.length - 1]?.pct ?? 0,
      benchFinal: idx[idx.length - 1]?.pct ?? 0,
    };
  }, [fullNav, range, bench]);

  const axisLabel = useMemo(() => {
    const values = data.flatMap((p) => (p.bench == null ? [p.portfolio] : [p.portfolio, p.bench]));
    return percentAxisFormatter(Math.min(0, ...values), Math.max(0, ...values));
  }, [data]);

  const delta = portFinal - benchFinal;
  const outperformed = delta >= 0;

  // Loading while index history or holdings' price history hasn't arrived.
  const loading = useMemo(() => {
    const syms = holdings.filter((h) => h.shares > 0).map((h) => h.symbol);
    if (syms.length === 0) return false;
    const histMissing = syms.some((s) => !history[s] || history[s].length === 0);
    return data.length < 2 && (bench.length === 0 || histMissing);
  }, [holdings, history, bench, data]);

  return (
    <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-bold tracking-[-.02em]">Portfolio vs {benchLabel}</h2>
        {/* benchmark selector */}
        <div className="inline-flex gap-1 rounded-[10px] bg-canvas p-1">
          {INDICES.map((i) => (
            <button
              key={i.code}
              onClick={() => setBenchmark(i.code)}
              className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                benchmark === i.code
                  ? "text-white"
                  : "text-ink-2 hover:text-ink"
              }`}
              style={benchmark === i.code ? { background: BENCH_COLOR } : undefined}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-[12px] text-ink-3">Cumulative return</p>

      {/* range pills */}
      <div className="mb-4 flex flex-wrap gap-1">
        {RANGES.map((r) => {
          const enabled = available.has(r);
          return (
            <button
              key={r}
              onClick={() => setRange(r)}
              disabled={!enabled}
              title={enabled ? undefined : "No history this far back yet"}
              className={`rounded-lg px-3 py-1 text-[12px] font-semibold transition-colors ${
                range === r
                  ? "bg-card text-ink shadow-card"
                  : enabled
                    ? "text-ink-3 hover:text-ink"
                    : "cursor-not-allowed text-ink-3 opacity-35"
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>

      {loading ? (
        <ChartSkeleton height={220} />
      ) : data.length < 2 ? (
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
                  width={54}
                  tickFormatter={axisLabel}
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
                    n === "portfolio" ? "Portfolio" : benchLabel,
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
                  dataKey="bench"
                  stroke={BENCH_COLOR}
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
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BENCH_COLOR }} />
              {benchLabel}
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
                {benchLabel}
              </div>
              <div
                className="num mt-0.5 text-[18px] font-bold"
                style={{ color: benchFinal >= 0 ? "var(--color-gain)" : "var(--color-loss-strong)" }}
              >
                {benchFinal >= 0 ? "+" : ""}
                {benchFinal.toFixed(1)}%
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
