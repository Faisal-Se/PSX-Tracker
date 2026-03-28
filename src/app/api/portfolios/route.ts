import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import { getPortfolios, createPortfolio } from "@/lib/gdrive";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const portfolios = await getPortfolios();

  // Add _count for compatibility with frontend
  const result = portfolios.map((p) => ({
    ...p,
    _count: { transactions: p.transactions.length },
  }));

  return NextResponse.json(result);
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

  const portfolio = await createPortfolio({
    name,
    type: type || "Personal",
    cashBalance: cashBalance || 1000000,
  });

  return NextResponse.json(portfolio);
}
