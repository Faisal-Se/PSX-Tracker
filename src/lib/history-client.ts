import type { HistoryPoint } from "./price-history";

export type { HistoryPoint };

type HistoryMap = Record<string, HistoryPoint[]>;

/** The app's own recorded history for these symbols (one private request). */
async function fetchRecorded(
  symbols: string[],
  backfill: boolean
): Promise<HistoryMap> {
  try {
    const params = new URLSearchParams({ symbols: symbols.join(",") });
    if (backfill) params.set("backfill", "1");
    const res = await fetch(`/api/history?${params}`);
    if (!res.ok) return {};
    return ((await res.json()) as HistoryMap) ?? {};
  } catch {
    return {};
  }
}

/** PSX's feed for one symbol (public, served from the CDN). */
async function fetchFeed(symbol: string): Promise<HistoryPoint[]> {
  try {
    const res = await fetch(`/api/psx/history?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { date: string; close: number }[];
    if (!Array.isArray(data)) return [];
    return data
      .filter((p) => p && typeof p.date === "string" && p.close > 0)
      .map((p) => ({
        date: p.date,
        open: p.close,
        high: p.close,
        low: p.close,
        close: p.close,
        volume: 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Put the two sources together for one symbol.
 *
 * PSX's feed is the main source while it is available. Recorded prices add
 * the days it doesn't have yet — above all today's live price. When the feed
 * returns nothing, the recorded history stands in by itself, along with any
 * year-ago reference points that were asked for.
 */
export function mergeHistory(
  feed: HistoryPoint[],
  recorded: HistoryPoint[]
): HistoryPoint[] {
  if (feed.length < 2) return recorded;
  const byDate = new Map<string, HistoryPoint>();
  for (const p of recorded) if (!p.backfill) byDate.set(p.date, p);
  // The feed's closing price is authoritative for any day it covers.
  for (const p of feed) byDate.set(p.date, p);
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Price history for several symbols, oldest first. Symbols with no history
 * come back as empty lists; a failed request never throws.
 */
export async function fetchHistory(
  symbols: string[],
  options: {
    /** Keep only the most recent N points. */
    limit?: number;
    /** Include year-ago reference points when the feed is unavailable. */
    backfill?: boolean;
  } = {}
): Promise<HistoryMap> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const out: HistoryMap = {};
  for (const s of unique) out[s] = [];
  if (unique.length === 0) return out;

  // The recorded request also takes today's snapshot, so it always runs.
  const [recorded, ...feeds] = await Promise.all([
    fetchRecorded(unique, Boolean(options.backfill)),
    ...unique.map(fetchFeed),
  ]);

  unique.forEach((symbol, i) => {
    const own = recorded[symbol.toUpperCase()] ?? recorded[symbol] ?? [];
    const merged = mergeHistory(feeds[i], Array.isArray(own) ? own : []);
    out[symbol] = options.limit ? merged.slice(-options.limit) : merged;
  });
  return out;
}
