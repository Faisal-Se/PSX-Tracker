import { NextResponse } from "next/server";
import { getMarketWatch, getKSE100, searchStocks } from "@/lib/psx";

// Market data is public and identical for every visitor, so it is safe to let
// the CDN serve it. Repeat callers stop at the edge instead of waking a
// function and re-scraping dps.psx.com.pk. The 60s window matches what the
// clients already see: CACHE_DURATION in lib/psx.ts, the upstream revalidate,
// and the 60s poll interval in the dashboard/market/watchlist pages.
const LIVE_CACHE = "public, s-maxage=60, stale-while-revalidate=300";
// Never let a failure or an empty scrape stick in the CDN for a minute.
const NO_CACHE = "no-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const query = searchParams.get("q");

  try {
    if (action === "kse100") {
      const data = await getKSE100();
      // A zeroed index is the fallback shape, not real data — don't cache it.
      const cacheable = data.current > 0;
      return NextResponse.json(data, {
        headers: { "Cache-Control": cacheable ? LIVE_CACHE : NO_CACHE },
      });
    }

    if (action === "search" && query) {
      const results = await searchStocks(query);
      return NextResponse.json(results.slice(0, 20), {
        headers: { "Cache-Control": LIVE_CACHE },
      });
    }

    // Default: return all market data
    const stocks = await getMarketWatch();
    return NextResponse.json(stocks, {
      headers: {
        // getMarketWatch() degrades to [] when the scrape fails.
        "Cache-Control": stocks.length > 0 ? LIVE_CACHE : NO_CACHE,
      },
    });
  } catch (error) {
    console.error("PSX API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch PSX data" },
      { status: 500, headers: { "Cache-Control": NO_CACHE } }
    );
  }
}
