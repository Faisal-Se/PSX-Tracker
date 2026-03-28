import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: user.id },
    include: {
      holdings: true,
      _count: { select: { transactions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(portfolios);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name, type, cashBalance } = await req.json();

  if (!name) {
    return NextResponse.json(
      { error: "Portfolio name is required" },
      { status: 400 }
    );
  }

  const portfolio = await prisma.portfolio.create({
    data: {
      name,
      type: type || "Personal",
      cashBalance: cashBalance || 1000000,
      userId: user.id,
    },
  });

  return NextResponse.json(portfolio);
}
