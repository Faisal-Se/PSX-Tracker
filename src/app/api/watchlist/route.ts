import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "@/lib/gdrive";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const watchlist = await getWatchlist();
  return NextResponse.json(watchlist);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { symbol, companyName } = await req.json();

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400 }
    );
  }

  const item = await addToWatchlist(symbol, companyName || symbol);
  if (!item) {
    return NextResponse.json(
      { error: "Stock already in watchlist" },
      { status: 409 }
    );
  }

  return NextResponse.json(item);
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400 }
    );
  }

  await removeFromWatchlist(symbol);
  return NextResponse.json({ success: true });
}
