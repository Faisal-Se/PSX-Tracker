/**
 * Return-series helpers for the NAV + benchmark charts.
 *
 * A "history map" is `Record<symbol, {date, close}[]>` (oldest→newest, as the
 * /api/psx/history endpoint returns once sorted). A holding is shares of a
 * symbol. We build a daily portfolio NAV series from holdings × close, hold
 * cash constant across the window, then derive return %s.
 */

export interface HistPt {
  date: string;
  close: number;
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

const RANGE_DAYS: Record<string, number> = {
  "1D": 2,
  "1W": 6,
  "1M": 22,
  "3M": 66,
  "6M": 132,
  "1Y": 252,
  "3Y": 756,
  "5Y": 1260,
  ALL: Infinity,
  All: Infinity,
};

export function sliceRange<T>(series: T[], range: string): T[] {
  const days = RANGE_DAYS[range] ?? Infinity;
  return days === Infinity ? series : series.slice(-days);
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
