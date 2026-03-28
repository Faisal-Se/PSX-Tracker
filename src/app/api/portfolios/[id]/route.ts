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

  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId: user.id },
    include: {
      holdings: true,
      _count: { select: { transactions: true } },
    },
  });

  if (!portfolio) {
    return NextResponse.json(
      { error: "Portfolio not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(portfolio);
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

  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId: user.id },
  });

  if (!portfolio) {
    return NextResponse.json(
      { error: "Portfolio not found" },
      { status: 404 }
    );
  }

  const updateData: Record<string, unknown> = {};

  if (name !== undefined) updateData.name = name;
  if (type !== undefined) updateData.type = type;

  if (addCash && addCash > 0) {
    updateData.cashBalance = portfolio.cashBalance + addCash;
  }

  if (removeCash && removeCash > 0) {
    if (removeCash > portfolio.cashBalance) {
      return NextResponse.json(
        { error: "Insufficient cash balance" },
        { status: 400 }
      );
    }
    updateData.cashBalance = portfolio.cashBalance - removeCash;
  }

  const updated = await prisma.portfolio.update({
    where: { id },
    data: updateData,
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

  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId: user.id },
  });

  if (!portfolio) {
    return NextResponse.json(
      { error: "Portfolio not found" },
      { status: 404 }
    );
  }

  await prisma.portfolio.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
