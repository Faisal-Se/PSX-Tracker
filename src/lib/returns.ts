/**
 * Return-series helpers for the NAV + benchmark charts.
 *
 * A "history map" is `Record<symbol, {date, close}[]>` (oldest→newest, as the
 * /api/history endpoint returns). A holding is shares of a
 * symbol. We build a daily portfolio NAV series from holdings × close, hold
 * cash constant across the window, then derive return %s.
 */

export interface HistPt {
  date: string;
  close: number;
  /** A year-ago reference point rather than a recorded price. */
  backfill?: boolean;
}

export interface HoldingLike {
  symbol: string;
  shares: number;
  avgPrice: number;
}

export interface NavPoint {
  date: string;
  value: number;
}

/** Union of trading dates across all symbols' histories, sorted ascending. */
function unionDates(history: Record<string, HistPt[]>, symbols: string[]): string[] {
  const set = new Set<string>();
  for (const s of symbols) for (const p of history[s] || []) if (p.close > 0) set.add(p.date);
  return Array.from(set).sort();
}

/** Most-recent close on or before `date` (fallback to avgPrice). */
function closeOnOrBefore(hist: HistPt[], date: string, fallback: number): number {
  let close = fallback;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].date <= date && hist[i].close > 0) {
      close = hist[i].close;
      break;
    }
  }
  return close;
}

/**
 * Daily NAV series for a set of holdings + (constant) cash, over the union of
 * available trading dates. Returns [] if fewer than 2 dates of data.
 */
export function buildNavSeries(
  holdings: HoldingLike[],
  cash: number,
  history: Record<string, HistPt[]>
): NavPoint[] {
  const symbols = holdings.filter((h) => h.shares > 0).map((h) => h.symbol);
  if (symbols.length === 0) return [];
  const dates = unionDates(history, symbols);
  if (dates.length < 2) return [];

  const sorted: Record<string, HistPt[]> = {};
  for (const s of symbols)
    sorted[s] = [...(history[s] || [])].sort((a, b) => a.date.localeCompare(b.date));

  return dates.map((date) => {
    let value = cash;
    for (const h of holdings) {
      if (h.shares <= 0) continue;
      value += h.shares * closeOnOrBefore(sorted[h.symbol] || [], date, h.avgPrice);
    }
    return { date, value };
  });
}

/**
 * Calendar days each range looks back from the latest point. The year-based
 * ranges carry a few days of slack so a year-ago point that was moved off a
 * weekend still falls inside its window.
 */
const RANGE_CALENDAR_DAYS: Record<string, number> = {
  "1W": 7,
  "1M": 31,
  "3M": 92,
  "6M": 183,
  "1Y": 372,
  "3Y": 1102,
  "5Y": 1833,
};

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * The part of a dated series that falls inside a range, by calendar date.
 * (History can have gaps, so "the last N points" is not "the last N days".)
 */
export function sliceRange<T extends { date: string }>(series: T[], range: string): T[] {
  if (series.length === 0) return series;
  const last = series[series.length - 1].date;

  if (range === "1D") {
    // The latest session against the one before it, weekend included.
    const tail = series.slice(-2);
    return tail.length === 2 && tail[0].date >= daysBefore(last, 7) ? tail : series.slice(-1);
  }

  const days = RANGE_CALENDAR_DAYS[range];
  if (!days) return series; // ALL
  const cutoff = daysBefore(last, days);
  return series.filter((p) => p.date >= cutoff);
}

/**
 * Which ranges have something to show. A range is switched off when it would
 * draw fewer than two points, or exactly what a shorter range already draws.
 * ALL stays on whenever there is anything to chart.
 */
export function availableRanges<T extends { date: string }>(
  series: T[],
  ranges: readonly string[]
): Set<string> {
  const on = new Set<string>();
  let shown = 0;
  for (const r of ranges) {
    const count = sliceRange(series, r).length;
    if (r === "ALL" || r === "All") {
      if (count >= 2) on.add(r);
    } else if (count >= 2 && count > shown) {
      on.add(r);
      shown = count;
    }
  }
  return on;
}

/** The selected range if it has data, otherwise the nearest one that does. */
export function effectiveRange<R extends string>(
  selected: R,
  ranges: readonly R[],
  available: Set<string>
): R {
  if (available.has(selected)) return selected;
  return ranges.find((r) => available.has(r)) ?? selected;
}

/** Recorded prices only — for sparklines, which show the recent trend. */
export function recordedOnly<T extends { backfill?: boolean }>(points: T[] | undefined): T[] {
  return (points ?? []).filter((p) => !p.backfill);
}

/** First day the app itself recorded a price for any of these symbols. */
export function recordingStart(
  history: Record<string, HistPt[]>,
  symbols: string[]
): string | null {
  let first: string | null = null;
  for (const s of symbols)
    for (const p of history[s] || [])
      if (!p.backfill && (first === null || p.date < first)) first = p.date;
  return first;
}

/** True when any of these symbols has a year-ago reference point. */
export function hasBackfill(history: Record<string, HistPt[]>, symbols: string[]): boolean {
  return symbols.some((s) => (history[s] || []).some((p) => p.backfill));
}

/**
 * Axis label for money that keeps neighbouring ticks distinct: a chart
 * spanning a few hundred rupees shows 184.08K rather than 184K five times.
 */
export function moneyAxisFormatter(min: number, max: number): (n: number) => string {
  const span = Math.abs(max - min);
  const big = Math.max(Math.abs(min), Math.abs(max));
  if (big >= 1e6) {
    const d = span >= 5e5 ? 1 : span >= 5e4 ? 2 : 3;
    return (n) => `${(n / 1e6).toFixed(d)}M`;
  }
  if (big >= 1e3) {
    const d = span >= 5e3 ? 0 : span >= 500 ? 1 : 2;
    return (n) => `${(n / 1e3).toFixed(d)}K`;
  }
  return (n) => String(Math.round(n));
}

/** Axis label for a percentage, with decimals when the moves are small. */
export function percentAxisFormatter(min: number, max: number): (n: number) => string {
  const span = Math.abs(max - min);
  const d = span >= 4 ? 0 : span >= 0.4 ? 1 : 2;
  return (n) => {
    const text = Number(n).toFixed(d);
    // Avoid "-0.00%".
    const zero = Number(text) === 0;
    return `${zero || Number(n) < 0 ? "" : "+"}${zero ? (0).toFixed(d) : text}%`;
  };
}

/**
 * Cumulative return % series, rebased so the first point is 0%.
 * TWR over a series with no external cash flows mid-window equals the
 * value-based cumulative return; we compute it as the chained product of
 * daily returns, which is the time-weighted definition and stays correct if
 * the NAV series is later split at deposit/withdrawal boundaries.
 */
export function cumulativeReturnPct(series: NavPoint[]): { date: string; pct: number }[] {
  if (series.length < 1) return [];
  let factor = 1;
  const out: { date: string; pct: number }[] = [{ date: series[0].date, pct: 0 }];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].value;
    const cur = series[i].value;
    if (prev > 0) factor *= cur / prev;
    out.push({ date: series[i].date, pct: (factor - 1) * 100 });
  }
  return out;
}

export interface CashFlow {
  date: string;
  amount: number; // + deposit, − withdrawal
}

/**
 * Flow-aware time-weighted return. On a day with an external cash flow, the
 * flow is removed from that day's value change so deposits/withdrawals don't
 * count as performance — the defining feature of TWR. With no flows this
 * reduces to the plain chained daily return (== value-based return).
 */
export function twrReturnPct(
  series: NavPoint[],
  flows: CashFlow[]
): { date: string; pct: number }[] {
  if (series.length < 1) return [];
  // Net external flow per date.
  const flowByDate = new Map<string, number>();
  for (const f of flows) flowByDate.set(f.date, (flowByDate.get(f.date) || 0) + f.amount);

  let factor = 1;
  const out: { date: string; pct: number }[] = [{ date: series[0].date, pct: 0 }];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].value;
    const cur = series[i].value;
    const flow = flowByDate.get(series[i].date) || 0;
    // Sub-period return excludes the external flow injected this day.
    if (prev > 0) factor *= (cur - flow) / prev;
    out.push({ date: series[i].date, pct: (factor - 1) * 100 });
  }
  return out;
}

/** Simple (value-based) cumulative return % vs the first point. */
export function simpleReturnPct(series: NavPoint[]): { date: string; pct: number }[] {
  if (series.length < 1) return [];
  const base = series[0].value || 1;
  return series.map((p) => ({ date: p.date, pct: (p.value / base - 1) * 100 }));
}

/** Convert an index history (closes) to a rebased cumulative % series. */
export function indexReturnPct(
  hist: HistPt[],
  dates: string[]
): { date: string; pct: number }[] {
  if (hist.length === 0 || dates.length === 0) return [];
  const sorted = [...hist].sort((a, b) => a.date.localeCompare(b.date));
  const baseClose = closeOnOrBefore(sorted, dates[0], 0) || sorted[0]?.close || 1;
  return dates.map((d) => {
    const c = closeOnOrBefore(sorted, d, baseClose);
    return { date: d, pct: (c / baseClose - 1) * 100 };
  });
}

/** All-time-high info from a NAV series. */
export function athInfo(series: NavPoint[]): { ath: number; athDate: string; isAtAth: boolean } {
  if (series.length === 0) return { ath: 0, athDate: "", isAtAth: false };
  let ath = -Infinity;
  let athDate = "";
  for (const p of series) {
    if (p.value > ath) {
      ath = p.value;
      athDate = p.date;
    }
  }
  const last = series[series.length - 1];
  return { ath, athDate, isAtAth: last.value >= ath - 1e-6 };
}
