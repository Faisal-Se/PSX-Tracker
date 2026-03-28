import { NextResponse } from "next/server";
import { getMarketWatch, getKSE100, searchStocks } from "@/lib/psx";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const query = searchParams.get("q");

  try {
    if (action === "kse100") {
      const data = await getKSE100();
      return NextResponse.json(data);
    }

    if (action === "search" && query) {
      const results = await searchStocks(query);
      return NextResponse.json(results.slice(0, 20));
    }

    // Default: return all market data
    const stocks = await getMarketWatch();
    return NextResponse.json(stocks);
  } catch (error) {
    console.error("PSX API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch PSX data" },
      { status: 500 }
    );
  }
}
