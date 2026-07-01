import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import {
  getPortfolios,
  getModelPortfolios,
  updatePortfolio,
  updateModelPortfolio,
  generateId,
} from "@/lib/gdrive";

/**
 * Apply a stock split across ALL portfolios and model portfolios at once.
 *
 * A split (numerator:denominator, e.g. 2:1) multiplies share count by
 * num/denom and divides the average cost by the same ratio, so position VALUE
 * and cost basis are unchanged — only the share count and per-share price move.
 * A SPLIT transaction is recorded on each affected portfolio for the audit
 * trail. Each portfolio/model is written atomically (optimistic concurrency).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const symbol = String(body.symbol || "").toUpperCase().trim();
  const numerator = Number(body.numerator);
  const denominator = Number(body.denominator);

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  ) {
    return NextResponse.json(
      { error: "Split ratio must use positive numbers (e.g. 2 for 1)" },
      { status: 400 }
    );
  }
  if (numerator === denominator) {
    return NextResponse.json(
      { error: "A 1:1 split changes nothing" },
      { status: 400 }
    );
  }

  const ratio = numerator / denominator; // shares ×ratio, avgPrice ÷ratio
  const now = new Date().toISOString();
  const label = `Split ${numerator}:${denominator}`;

  // Find which portfolios / models actually hold this symbol (so we only
  // rewrite — and only bump updatedAt on — the ones that need it).
  const [portfolios, models] = await Promise.all([
    getPortfolios(),
    getModelPortfolios(),
  ]);

  const affectedPortfolioIds = portfolios
    .filter((p) => p.holdings.some((h) => h.symbol === symbol && h.quantity > 0))
    .map((p) => p.id);
  const affectedModelIds = models
    .filter((m) => m.allocations.some((a) => a.symbol === symbol && a.shares > 0))
    .map((m) => m.id);

  if (affectedPortfolioIds.length === 0 && affectedModelIds.length === 0) {
    return NextResponse.json(
      { error: `No holdings of ${symbol} found to split` },
      { status: 400 }
    );
  }

  let holdingsAdjusted = 0;

  // Personal portfolios.
  for (const id of affectedPortfolioIds) {
    await updatePortfolio(id, (p) => {
      for (const h of p.holdings) {
        if (h.symbol !== symbol || h.quantity <= 0) continue;
        const newQty = Math.round(h.quantity * ratio);
        h.avgPrice = (h.avgPrice * h.quantity) / newQty; // preserves cost basis
        h.quantity = newQty;
        h.updatedAt = now;
        holdingsAdjusted++;
        p.transactions.push({
          id: generateId(),
          type: "SPLIT",
          symbol,
          companyName: h.companyName,
          quantity: newQty,
          price: h.avgPrice,
          total: 0,
          portfolioId: id,
          createdAt: now,
        });
      }
      return p;
    });
  }

  // Model portfolios.
  for (const id of affectedModelIds) {
    await updateModelPortfolio(id, (m) => {
      for (const a of m.allocations) {
        if (a.symbol !== symbol || a.shares <= 0) continue;
        const newShares = Math.round(a.shares * ratio);
        a.avgPrice = (a.avgPrice * a.shares) / newShares;
        a.shares = newShares;
        a.updatedAt = now;
        holdingsAdjusted++;
        m.transactions.push({
          id: generateId(),
          type: "SPLIT",
          symbol,
          companyName: a.companyName,
          quantity: newShares,
          price: a.avgPrice,
          total: 0,
          createdAt: now,
        });
      }
      return m;
    });
  }

  return NextResponse.json({
    success: true,
    symbol,
    ratio: label,
    holdingsAdjusted,
    portfoliosAffected: affectedPortfolioIds.length,
    modelsAffected: affectedModelIds.length,
  });
}
