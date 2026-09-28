import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import { updatePortfolio, getSettings, generateId } from "@/lib/gdrive";
import { ZERO_FEES } from "@/lib/fees";
import {
  ImportError,
  type ImportTrade,
  applyImport,
  tradeProblem,
} from "@/lib/import-trades";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { portfolioId, trades } = body as {
    portfolioId: string;
    trades: ImportTrade[];
  };
  // Off when the imported prices already include the broker's charges.
  const applyFees = body.applyFees !== false;

  if (!portfolioId) {
    return NextResponse.json({ error: "Portfolio is required" }, { status: 400 });
  }
  if (!Array.isArray(trades) || trades.length === 0) {
    return NextResponse.json({ error: "No trades to import" }, { status: 400 });
  }
  for (const trade of trades) {
    const problem = tradeProblem(trade);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }

  const fees = applyFees ? (await getSettings()).fees : ZERO_FEES;
  const now = new Date().toISOString();

  // Validate and apply inside one guarded read-modify-write, so the file is
  // only ever saved from a successful read and the import is all-or-nothing.
  let totalFees = 0;
  let updated;
  try {
    updated = await updatePortfolio(portfolioId, (portfolio) => {
      const result = applyImport(portfolio, trades, fees, {
        portfolioId,
        now,
        newId: generateId,
      });
      totalFees = result.totalFees;
      return result.portfolio;
    });
  } catch (err) {
    if (err instanceof ImportError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  if (!updated) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    imported: trades.length,
    fees: totalFees,
    newCashBalance: updated.cashBalance,
  });
}
