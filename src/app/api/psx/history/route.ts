import { NextResponse } from "next/server";
import { getStockHistory } from "@/lib/psx";

// Public market data, identical for every visitor, so the CDN serves it.
// Daily closes change once a day; four hours of edge freshness keeps requests
// to PSX rare, and stale-while-revalidate means nobody waits on a refetch.
const EOD_CACHE = "public, s-maxage=14400, stale-while-revalidate=86400";
const NO_CACHE = "no-store";

/**
 * GET /api/psx/history?symbol=KEL[&limit=60]
 *
 * Daily closes from PSX's feed as [{ date, close }], oldest first. An empty
 * list means the feed is unavailable; clients then use the recorded history
 * from /api/history instead.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").trim().toUpperCase();

  if (!/^[A-Z0-9.\-]{1,20}$/.test(symbol)) {
    return NextResponse.json(
      { error: "A valid symbol is required" },
      { status: 400, headers: { "Cache-Control": NO_CACHE } }
    );
  }

  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : null;

  const full = await getStockHistory(symbol);
  const history = limit ? full.slice(-limit) : full;
  return NextResponse.json(history, {
    headers: {
      // Never let an outage or an unknown symbol stick in the CDN.
      "Cache-Control": history.length > 0 ? EOD_CACHE : NO_CACHE,
    },
  });
}
