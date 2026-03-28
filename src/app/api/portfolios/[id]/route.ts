import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import { getPortfolio, updatePortfolio, deletePortfolio } from "@/lib/gdrive";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const portfolio = await getPortfolio(id);

  if (!portfolio) {
    return NextResponse.json(
      { error: "Portfolio not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...portfolio,
    _count: { transactions: portfolio.transactions.length },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, type, addCash, removeCash } = body;

  const updated = await updatePortfolio(id, (p) => {
    if (name !== undefined) p.name = name;
    if (type !== undefined) p.type = type;

    if (addCash && addCash > 0) {
      p.cashBalance += addCash;
    }

    if (removeCash && removeCash > 0) {
      if (removeCash > p.cashBalance) {
        throw new Error("Insufficient cash balance");
      }
      p.cashBalance -= removeCash;
    }

    return p;
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Portfolio not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deletePortfolio(id);

  if (!deleted) {
    return NextResponse.json(
      { error: "Portfolio not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
