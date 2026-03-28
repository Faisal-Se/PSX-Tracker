import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const model = await prisma.modelPortfolio.findFirst({
    where: { id, userId: user.id },
    include: {
      allocations: { orderBy: { percentage: "desc" } },
      transactions: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });

  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(model);
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

  const model = await prisma.modelPortfolio.findFirst({
    where: { id, userId: user.id },
  });

  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Add cash flow
  if (addCash && addCash > 0) {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.modelTransaction.create({
        data: {
          type: "CASH_IN",
          symbol: "CASH",
          companyName: "Cash Deposit",
          quantity: 0,
          price: 0,
          total: addCash,
          modelPortfolioId: id,
        },
      });

      return tx.modelPortfolio.update({
        where: { id },
        data: { cashBalance: model.cashBalance + addCash },
        include: {
          allocations: { orderBy: { percentage: "desc" } },
          transactions: { orderBy: { createdAt: "desc" }, take: 100 },
        },
      });
    });

    return NextResponse.json(updated);
  }

  // Withdraw cash flow
  if (withdrawCash && withdrawCash > 0) {
    if (withdrawCash > model.cashBalance) {
      return NextResponse.json(
        { error: `Insufficient cash. Available: PKR ${model.cashBalance.toFixed(2)}` },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.modelTransaction.create({
        data: {
          type: "CASH_OUT",
          symbol: "CASH",
          companyName: "Cash Withdrawal",
          quantity: 0,
          price: 0,
          total: withdrawCash,
          modelPortfolioId: id,
        },
      });

      return tx.modelPortfolio.update({
        where: { id },
        data: { cashBalance: model.cashBalance - withdrawCash },
        include: {
          allocations: { orderBy: { percentage: "desc" } },
          transactions: { orderBy: { createdAt: "desc" }, take: 100 },
        },
      });
    });

    return NextResponse.json(updated);
  }

  // Update name/description
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;

  const updated = await prisma.modelPortfolio.update({
    where: { id },
    data: updateData,
    include: {
      allocations: { orderBy: { percentage: "desc" } },
      transactions: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });

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

  const model = await prisma.modelPortfolio.findFirst({
    where: { id, userId: user.id },
  });

  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.modelPortfolio.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
