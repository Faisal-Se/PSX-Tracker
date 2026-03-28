import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const watchlist = await prisma.watchlist.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

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

  try {
    const item = await prisma.watchlist.create({
      data: {
        symbol,
        companyName: companyName || symbol,
        userId: user.id,
      },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json(
      { error: "Stock already in watchlist" },
      { status: 409 }
    );
  }
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

  await prisma.watchlist.deleteMany({
    where: { userId: user.id, symbol },
  });

  return NextResponse.json({ success: true });
}
