import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import {
  getPriceHistory,
  updatePriceHistory,
  getPortfolios,
  getModelPortfolios,
  getWatchlist,
} from "@/lib/gdrive";
import { getMarketWatch, getIndices } from "@/lib/psx";
import {
  INDEX_CODES,
  type HistoryPoint,
  type PriceHistoryFile,
  type Quote,
  applySnapshot,
  isRecordingDue,
  parseAsOfDate,
  resolveSession,
  toPoints,
} from "@/lib/price-history";

// Per-user data read from the user's own Drive: never cacheable.
const PRIVATE = { "Cache-Control": "private, no-store" };
const MAX_SYMBOLS = 60;

/** Everything the user holds or follows, so it is recorded on every visit. */
async function trackedSymbols(): Promise<string[]> {
  const [portfolios, models, watchlist] = await Promise.all([
    getPortfolios(),
    getModelPortfolios(),
    getWatchlist(),
  ]);
  const set = new Set<string>();
  for (const p of portfolios) for (const h of p.holdings) set.add(h.symbol);
  for (const m of models)
    for (const a of m.allocations) if (a.symbol !== "CASH") set.add(a.symbol);
  for (const w of watchlist) set.add(w.symbol);
  return Array.from(set);
}

/** Take a price snapshot and write it into the user's history file. */
async function record(
  file: PriceHistoryFile,
  requested: string[],
  now: Date
): Promise<PriceHistoryFile> {
  const [stocks, { asOf, indices }, tracked] = await Promise.all([
    getMarketWatch(),
    getIndices(),
    trackedSymbols(),
  ]);
  // No prices means the scrape failed; leave the history as it is.
  if (stocks.length === 0) return file;

  const quotes: Record<string, Quote> = {};
  for (const s of stocks) {
    // PSX publishes 0 when it has no one-year figure (e.g. a new listing).
    const pct = s.yearChangePercent;
    const yearAgoPrice =
      pct !== 0 && pct > -100
        ? Math.round((s.current / (1 + pct / 100)) * 100) / 100
        : undefined;
    quotes[s.symbol] = { current: s.current, previousClose: s.ldcp, yearAgoPrice };
  }
  for (const [code, q] of Object.entries(indices))
    quotes[code] = { current: q.current, previousClose: q.current - q.change };

  const symbols = Array.from(
    new Set([...Object.keys(file.series), ...requested, ...tracked, ...INDEX_CODES])
  );
  const session = resolveSession(parseAsOfDate(asOf), now);
  return updatePriceHistory((current) =>
    applySnapshot(current, { ...session, quotes }, symbols, now)
  );
}

/**
 * GET /api/history?symbols=KEL,OGDC,KSE100[&limit=60][&backfill=1]
 *
 * Returns each symbol's recorded closing prices, oldest first. With
 * backfill=1 the year-ago reference points are included, flagged `backfill`.
 * Reading also
 * records: when a fresh price is due, it is written before responding, so the
 * history grows simply by the app being used.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: PRIVATE }
    );
  }

  const { searchParams } = new URL(req.url);
  const symbols = Array.from(
    new Set(
      (searchParams.get("symbols") || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9.\-]{1,20}$/.test(s))
    )
  ).slice(0, MAX_SYMBOLS);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : undefined;

  const withBackfill = searchParams.get("backfill") === "1";

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "symbols is required" },
      { status: 400, headers: PRIVATE }
    );
  }

  try {
    let file = await getPriceHistory();
    const now = new Date();
    if (isRecordingDue(file, now, symbols)) {
      try {
        file = await record(file, symbols, now);
      } catch (error) {
        // Recording is best-effort; still serve what is already stored.
        console.error("Price history recording failed:", error);
      }
    }

    const body: Record<string, HistoryPoint[]> = {};
    for (const symbol of symbols)
      body[symbol] = toPoints(
        file.series[symbol],
        limit,
        withBackfill ? file.yearAgo[symbol] : undefined
      );
    return NextResponse.json(body, { headers: PRIVATE });
  } catch (error) {
    console.error("Price history error:", error);
    return NextResponse.json(
      { error: "Failed to load price history" },
      { status: 500, headers: PRIVATE }
    );
  }
}
