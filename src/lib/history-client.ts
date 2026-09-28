import type { HistoryPoint } from "./price-history";

export type { HistoryPoint };

/**
 * Recorded closing prices for several symbols in one request. Symbols with no
 * history yet come back as empty lists; a failed request yields all-empty.
 */
export async function fetchHistory(
  symbols: string[],
  options: {
    limit?: number;
    /** Include year-ago reference points (flagged `backfill`). */
    backfill?: boolean;
  } = {}
): Promise<Record<string, HistoryPoint[]>> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const empty: Record<string, HistoryPoint[]> = {};
  for (const s of unique) empty[s] = [];
  if (unique.length === 0) return empty;

  try {
    const params = new URLSearchParams({ symbols: unique.join(",") });
    if (options.limit) params.set("limit", String(options.limit));
    if (options.backfill) params.set("backfill", "1");
    const res = await fetch(`/api/history?${params}`);
    if (!res.ok) return empty;
    const data = (await res.json()) as Record<string, HistoryPoint[]>;
    for (const s of unique) {
      const points = data?.[s.toUpperCase()] ?? data?.[s];
      if (Array.isArray(points)) empty[s] = points;
    }
    return empty;
  } catch {
    return empty;
  }
}
