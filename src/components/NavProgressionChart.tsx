"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { formatPKR } from "@/lib/market-status";
import { ChartSkeleton } from "@/components/ui/skeleton";
import {
  buildNavSeries,
  sliceRange,
  athInfo,
  type HoldingLike,
  type HistPt,
} from "@/lib/returns";

const RANGES = ["1M", "6M", "1Y", "ALL"] as const;

function compactK(n: number): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
}

function fmtDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

/**
 * NAV Progression — value-over-time area with period tabs, crosshair tooltip,
 * ATH marker and growth %. Theme-aware (uses gain/loss tokens + currentColor).
 */
export function NavProgressionChart({
  holdings,
  cash,
  history,
  title = "NAV Progression",
}: {
  holdings: HoldingLike[];
  cash: number;
  history: Record<string, HistPt[]>;
  title?: string;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("1M");

  const fullSeries = useMemo(
    () => buildNavSeries(holdings, cash, history),
    [holdings, cash, history]
  );
  const series = useMemo(() => sliceRange(fullSeries, range), [fullSeries, range]);

  const { growthPct, ath } = useMemo(() => {
    if (series.length < 2) return { growthPct: 0, ath: athInfo(fullSeries) };
    const first = series[0].value || 1;
    const last = series[series.length - 1].value;
    return { growthPct: (last / first - 1) * 100, ath: athInfo(fullSeries) };
  }, [series, fullSeries]);

  // Loading = holdings exist but their price history hasn't all arrived yet.
  const loading = useMemo(() => {
    const syms = holdings.filter((h) => h.shares > 0).map((h) => h.symbol);
    if (syms.length === 0) return false;
    return series.length < 2 && syms.some((s) => !history[s] || history[s].length === 0);
  }, [holdings, history, series]);

  const last = series[series.length - 1]?.value ?? 0;
  const up = growthPct >= 0;
  const color = up ? "var(--color-gain)" : "var(--color-loss-strong)";
  const id = `nav-${title.replace(/\s/g, "")}`;

  return (
    <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-bold tracking-[-.02em]">{title}</h2>
        <div className="flex gap-1 rounded-[11px] bg-canvas p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-[11px] py-[5px] text-[12px] font-semibold transition-colors ${
                range === r ? "bg-card text-ink shadow-card" : "text-ink-3 hover:text-ink"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ChartSkeleton height={260} />
      ) : series.length < 2 ? (
        <div className="flex h-[260px] items-center justify-center">
          <p className="text-[13px] text-ink-3">Not enough history to chart yet</p>
        </div>
      ) : (
        <>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
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
                  width={44}
                  tickFormatter={compactK}
                  tick={{ fill: "var(--color-ink-3)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={["dataMin", "dataMax"]}
                />
                {ath.athDate && (
                  <ReferenceLine
                    y={ath.ath}
                    stroke="var(--color-ink-3)"
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                )}
                <Tooltip
                  cursor={{ stroke: color, strokeWidth: 1 }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--color-ink)",
                    boxShadow: "var(--shadow-pop)",
                  }}
                  labelFormatter={(d) => fmtDate(String(d))}
                  formatter={(v) => [`PKR ${formatPKR(Number(v), { decimals: 0 })}`, "Value"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2.4}
                  fill={`url(#${id})`}
                  dot={false}
                  activeDot={{ r: 4, fill: color }}
                  isAnimationActive
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
            <div>
              <div className="num text-[30px] font-bold leading-none tracking-[-.03em]">
                {compactK(last)} PKR
              </div>
              {ath.isAtAth ? (
                <div className="mt-1.5 text-[13px] font-semibold text-gain">
                  ATH Reached · {ath.athDate ? new Date(ath.athDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : ""}
                </div>
              ) : (
                <div className="mt-1.5 text-[13px] text-ink-3">
                  ATH {compactK(ath.ath)} PKR
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">
                Growth
              </div>
              <div
                className="num mt-0.5 inline-flex items-center gap-1 text-[22px] font-bold"
                style={{ color }}
              >
                <TrendingUp className="h-4 w-4" style={{ transform: up ? "none" : "scaleY(-1)" }} />
                {up ? "+" : ""}
                {growthPct.toFixed(1)}%
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
