/**
 * Self-recorded price history.
 *
 * PSX no longer gives outside apps its historical prices, so the app keeps its
 * own: each time the user opens it, the latest price of every stock they hold
 * or follow is written into a small file in their Google Drive app folder.
 *
 * This module is pure (no I/O, no imports) so the date rules can be tested on
 * their own. All dates are calendar days in Pakistan time, as YYYY-MM-DD.
 */

export interface PriceHistoryFile {
  version: 1;
  lastRecordedAt: string | null;
  /** Latest session whose prices are closing prices. */
  finalDate: string | null;
  /** Session that was recorded while still trading; its prices are intraday. */
  provisionalDate: string | null;
  /** symbol → date → closing price */
  series: Record<string, Record<string, number>>;
  /**
   * symbol → date → price one year before a recorded session, worked out from
   * the one-year change PSX still publishes. Kept apart from `series` because
   * these are derived reference points, not prices the app observed.
   */
  yearAgo: Record<string, Record<string, number>>;
}

export interface HistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** True for a year-ago reference point rather than a recorded price. */
  backfill?: boolean;
}

export interface Quote {
  current: number;
  previousClose: number;
  /** Price one year ago, when PSX publishes a one-year change. */
  yearAgoPrice?: number;
}

export interface Snapshot {
  /** The trading session the quotes belong to. */
  sessionDate: string;
  /** True once that session has closed, so `current` is the closing price. */
  final: boolean;
  quotes: Record<string, Quote>;
}

/** Index codes recorded for every user, for the benchmark charts. */
export const INDEX_CODES = ["KSE100", "KMI30", "KSE30", "ALLSHR"] as const;

/** Re-record at most this often while a session is open. */
const RECORD_INTERVAL_MS = 15 * 60 * 1000;
/** Pakistan is UTC+5 all year. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const OPEN_MINUTES = 9 * 60 + 30;
/** Latest close of the week is Friday's; after this a session is over. */
const CLOSED_MINUTES = 16 * 60 + 45;

export function emptyHistory(): PriceHistoryFile {
  return {
    version: 1,
    lastRecordedAt: null,
    finalDate: null,
    provisionalDate: null,
    series: {},
    yearAgo: {},
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Coerce stored JSON into a safe PriceHistoryFile. */
export function normalizeHistory(raw: unknown): PriceHistoryFile {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<PriceHistoryFile>;
  const out = emptyHistory();
  if (typeof src.lastRecordedAt === "string") out.lastRecordedAt = src.lastRecordedAt;
  if (typeof src.finalDate === "string" && DATE_RE.test(src.finalDate))
    out.finalDate = src.finalDate;
  if (typeof src.provisionalDate === "string" && DATE_RE.test(src.provisionalDate))
    out.provisionalDate = src.provisionalDate;
  out.series = cleanSeries(src.series);
  out.yearAgo = cleanSeries(src.yearAgo);
  return out;
}

function cleanSeries(raw: unknown): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [symbol, days] of Object.entries(raw)) {
    if (!days || typeof days !== "object") continue;
    const clean: Record<string, number> = {};
    for (const [date, close] of Object.entries(days)) {
      if (DATE_RE.test(date) && typeof close === "number" && close > 0)
        clean[date] = close;
    }
    out[symbol] = clean;
  }
  return out;
}

/** Calendar date and minutes-since-midnight in Pakistan for an instant. */
export function pktClock(now: Date): { date: string; minutes: number } {
  const shifted = new Date(now.getTime() + PKT_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function previousWeekday(date: string): string {
  let d = shiftDays(date, -1);
  while (isWeekend(d)) d = shiftDays(d, -1);
  return d;
}

/** The same calendar day one year earlier, moved back off a weekend. */
export function oneYearBefore(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  // Feb 29 has no counterpart in the previous year.
  const day = m === 2 && d === 29 ? 28 : d;
  let out = `${y - 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  while (isWeekend(out)) out = shiftDays(out, -1);
  return out;
}

export function nextWeekday(date: string): string {
  let d = shiftDays(date, 1);
  while (isWeekend(d)) d = shiftDays(d, 1);
  return d;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Sep 28, 2026 10:41 AM" → "2026-09-28"; null when it doesn't parse. */
export function parseAsOfDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  const day = Number(m[2]);
  if (month < 0 || day < 1 || day > 31) return null;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Which session do the quotes on PSX's pages belong to right now, and has it
 * closed? PSX's own "As of" date is used when available, because on a market
 * holiday the pages keep showing the previous session.
 */
export function resolveSession(
  asOfDate: string | null,
  now: Date
): { sessionDate: string; final: boolean } {
  const clock = pktClock(now);

  let sessionDate: string;
  if (asOfDate && asOfDate <= clock.date) {
    sessionDate = asOfDate;
  } else if (!isWeekend(clock.date) && clock.minutes >= OPEN_MINUTES) {
    sessionDate = clock.date;
  } else {
    sessionDate = previousWeekday(clock.date);
  }

  const final = sessionDate < clock.date || clock.minutes >= CLOSED_MINUTES;
  return { sessionDate, final };
}

/** Is it worth fetching prices and writing the file on this request? */
export function isRecordingDue(
  file: PriceHistoryFile,
  now: Date,
  requested: string[]
): boolean {
  if (requested.some((s) => !(s in file.series))) return true;
  if (!file.lastRecordedAt) return true;
  // Written before year-ago reference points existed: add them now.
  if (Object.keys(file.series).length > 0 && Object.keys(file.yearAgo).length === 0)
    return true;

  // The last session is closed and recorded: nothing can change before the
  // next one opens.
  if (file.finalDate) {
    const clock = pktClock(now);
    const nextOpen = nextWeekday(file.finalDate);
    if (clock.date < nextOpen) return false;
    if (clock.date === nextOpen && clock.minutes < OPEN_MINUTES) return false;
  }

  const last = Date.parse(file.lastRecordedAt);
  return !Number.isFinite(last) || now.getTime() - last >= RECORD_INTERVAL_MS;
}

/** Write one snapshot of prices into the history. Returns a new file. */
export function applySnapshot(
  file: PriceHistoryFile,
  snapshot: Snapshot,
  symbols: string[],
  now: Date
): PriceHistoryFile {
  const next: PriceHistoryFile = {
    ...file,
    series: { ...file.series },
    yearAgo: { ...file.yearAgo },
    lastRecordedAt: now.toISOString(),
  };

  const session = snapshot.sessionDate;
  const dayBefore = previousWeekday(session);
  const sessionAlreadyFinal = file.finalDate !== null && file.finalDate >= session;
  // The day before was recorded mid-session; its real close is now known.
  const upgradeDayBefore = file.provisionalDate === dayBefore;
  const yearBefore = oneYearBefore(session);

  for (const symbol of symbols) {
    const days = { ...(next.series[symbol] ?? {}) };
    next.series[symbol] = days;

    const quote = snapshot.quotes[symbol];
    if (!quote || !(quote.current > 0)) continue;

    if (!sessionAlreadyFinal || days[session] === undefined) {
      days[session] = quote.current;
    }
    if (quote.previousClose > 0 && (days[dayBefore] === undefined || upgradeDayBefore)) {
      days[dayBefore] = quote.previousClose;
    }
    // One reference point per session, a year back. Visiting daily therefore
    // also fills in last year, one day at a time.
    const old = { ...(next.yearAgo[symbol] ?? {}) };
    next.yearAgo[symbol] = old;
    if (
      quote.yearAgoPrice &&
      quote.yearAgoPrice > 0 &&
      old[yearBefore] === undefined
    ) {
      old[yearBefore] = quote.yearAgoPrice;
    }
  }

  if (snapshot.final) {
    if (!next.finalDate || next.finalDate < session) next.finalDate = session;
    next.provisionalDate = null;
  } else {
    next.provisionalDate = session;
  }
  return next;
}

/**
 * One symbol's series as chart points, oldest first. Year-ago reference
 * points are merged in only when `yearAgo` is given, and are flagged; a
 * recorded price always wins over a reference point for the same day.
 */
export function toPoints(
  days: Record<string, number> | undefined,
  limit?: number,
  yearAgo?: Record<string, number>
): HistoryPoint[] {
  const recorded = days ?? {};
  const dates = new Set(Object.keys(recorded));
  if (yearAgo) for (const d of Object.keys(yearAgo)) dates.add(d);

  const points = Array.from(dates)
    .sort()
    .map((date): HistoryPoint => {
      const observed = recorded[date];
      const close = observed ?? yearAgo![date];
      // Only the close is known; the other fields keep the chart shape.
      const point: HistoryPoint = {
        date,
        open: close,
        high: close,
        low: close,
        close,
        volume: 0,
      };
      if (observed === undefined) point.backfill = true;
      return point;
    });
  return limit && limit > 0 ? points.slice(-limit) : points;
}
