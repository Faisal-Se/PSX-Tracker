import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import {
  getModelPortfolio,
  updateModelPortfolio,
  deleteModelPortfolio,
  generateId,
} from "@/lib/gdrive";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const model = await getModelPortfolio(id);

  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Sort allocations by percentage desc, transactions by date desc (take 100)
  const sorted = {
    ...model,
    allocations: [...model.allocations].sort(
      (a, b) => b.percentage - a.percentage
    ),
    transactions: [...model.transactions]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 100),
  };

  return NextResponse.json(sorted);
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
  const { name, description, addCash, withdrawCash } = body;

  const now = new Date().toISOString();

  // Add cash flow
  if (addCash && addCash > 0) {
    const updated = await updateModelPortfolio(id, (m) => {
      m.cashBalance += addCash;
      m.transactions.push({
        id: generateId(),
        type: "CASH_IN",
        symbol: "CASH",
        companyName: "Cash Deposit",
        quantity: 0,
        price: 0,
        total: addCash,
        createdAt: now,
      });
      return m;
    });

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...updated,
      allocations: [...updated.allocations].sort(
        (a, b) => b.percentage - a.percentage
      ),
      transactions: [...updated.transactions]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 100),
    });
  }

  // Withdraw cash flow
  if (withdrawCash && withdrawCash > 0) {
    const existing = await getModelPortfolio(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (withdrawCash > existing.cashBalance) {
      return NextResponse.json(
        {
          error: `Insufficient cash. Available: PKR ${existing.cashBalance.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    const updated = await updateModelPortfolio(id, (m) => {
      m.cashBalance -= withdrawCash;
      m.transactions.push({
        id: generateId(),
        type: "CASH_OUT",
        symbol: "CASH",
        companyName: "Cash Withdrawal",
        quantity: 0,
        price: 0,
        total: withdrawCash,
        createdAt: now,
      });
      return m;
    });

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...updated,
      allocations: [...updated.allocations].sort(
        (a, b) => b.percentage - a.percentage
      ),
      transactions: [...updated.transactions]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 100),
    });
  }

  // Update name/description
  const updated = await updateModelPortfolio(id, (m) => {
    if (name !== undefined) m.name = name;
    if (description !== undefined) m.description = description;
    return m;
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...updated,
    allocations: [...updated.allocations].sort(
      (a, b) => b.percentage - a.percentage
    ),
    transactions: [...updated.transactions]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 100),
  });
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
  const deleted = await deleteModelPortfolio(id);

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
