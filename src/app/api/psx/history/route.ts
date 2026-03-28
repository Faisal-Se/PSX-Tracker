import { NextResponse } from "next/server";
import { getStockHistory } from "@/lib/psx";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400 }
    );
  }

  try {
    const history = await getStockHistory(symbol);
    return NextResponse.json(history);
  } catch (error) {
    console.error("Stock history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock history" },
      { status: 500 }
    );
  }
}
