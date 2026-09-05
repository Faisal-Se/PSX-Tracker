import { NextResponse } from "next/server";
import { getStockHistory } from "@/lib/psx";

// End-of-day bars only change once a day, after the close. An hour of edge
// freshness is far more than enough, and stale-while-revalidate means callers
// never wait on the refetch.
const EOD_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";
const NO_CACHE = "no-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400, headers: { "Cache-Control": NO_CACHE } }
    );
  }

  // Opt-in trim for callers that only draw a short sparkline. Omitted by
  // default, because the NAV progression chart and BenchmarkChart both offer
  // an "All" range and need the complete series.
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : null;

  try {
    const full = await getStockHistory(symbol);
    // getStockHistory() returns oldest-first, so the tail is the recent end.
    const history =
      limit !== null && Number.isFinite(limit) && limit > 0
        ? full.slice(-Math.floor(limit))
        : full;
    return NextResponse.json(history, {
      headers: {
        // getStockHistory() degrades to [] for a bad symbol or a failed fetch.
        "Cache-Control": history.length > 0 ? EOD_CACHE : NO_CACHE,
      },
    });
  } catch (error) {
    console.error("Stock history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock history" },
      { status: 500, headers: { "Cache-Control": NO_CACHE } }
    );
  }
}
