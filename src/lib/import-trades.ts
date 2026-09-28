/**
 * Applying a batch of imported trades to a portfolio. Pure, so the money
 * arithmetic can be tested without Drive or a signed-in user.
 */

import { type FeeSettings, buyCost, sellProceeds } from "./fees";

/** Error whose message is safe to show to the user. */
export class ImportError extends Error {}

export interface ImportTrade {
  type: "BUY" | "SELL";
  symbol: string;
  companyName: string;
  quantity: number;
  price: number;
}

interface Holding {
  id: string;
  symbol: string;
  companyName: string;
  quantity: number;
  avgPrice: number;
  createdAt: string;
  updatedAt: string;
}

interface Transaction {
  id: string;
  type: string;
  symbol: string;
  companyName: string;
  quantity: number;
  price: number;
  total: number;
  portfolioId: string;
  createdAt: string;
  realizedPnl?: number;
  fees?: number;
}

export interface ImportablePortfolio {
  cashBalance: number;
  holdings: Holding[];
  transactions: Transaction[];
  updatedAt: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The problem with a row, or null when it can be imported. */
export function tradeProblem(trade: Partial<ImportTrade>): string | null {
  const ok =
    !!trade.symbol &&
    (trade.type === "BUY" || trade.type === "SELL") &&
    Number.isInteger(trade.quantity) &&
    (trade.quantity as number) > 0 &&
    Number.isFinite(trade.price) &&
    (trade.price as number) > 0;
  return ok ? null : `Invalid trade data for ${trade.symbol || "unknown"}`;
}

/**
 * Apply the trades, in order, to `portfolio` (mutated and returned). Throws
 * ImportError, leaving the caller to discard the portfolio, when a row sells
 * more than is held at that point or the batch needs more cash than there is.
 */
export function applyImport<P extends ImportablePortfolio>(
  portfolio: P,
  trades: ImportTrade[],
  fees: FeeSettings,
  options: { portfolioId: string; now: string; newId: () => string }
): { portfolio: P; totalFees: number; netCash: number } {
  const { portfolioId, now, newId } = options;

  // Same fee model as every other trade path: all-in cost on a buy, net
  // proceeds on a sell.
  const priced = trades.map((trade) => {
    if (trade.type === "BUY") {
      const buy = buyCost(trade.quantity, trade.price, fees);
      return { trade, cash: -buy.total, total: buy.total, fees: buy.fees };
    }
    const sell = sellProceeds(trade.quantity, trade.price, fees);
    return { trade, cash: sell.net, total: sell.net, fees: sell.fees };
  });
  const netCash = round2(priced.reduce((sum, p) => sum + p.cash, 0));
  const totalFees = round2(priced.reduce((sum, p) => sum + p.fees, 0));

  // Sells are checked in order against what the earlier rows leave behind.
  const available = new Map<string, number>();
  for (const h of portfolio.holdings)
    available.set(h.symbol, (available.get(h.symbol) || 0) + h.quantity);
  for (const { trade } of priced) {
    const have = available.get(trade.symbol) || 0;
    if (trade.type === "BUY") {
      available.set(trade.symbol, have + trade.quantity);
    } else if (have < trade.quantity) {
      throw new ImportError(
        `Insufficient shares for ${trade.symbol}. Have ${have}, trying to sell ${trade.quantity}`
      );
    } else {
      available.set(trade.symbol, have - trade.quantity);
    }
  }
  if (portfolio.cashBalance + netCash < -0.005) {
    throw new ImportError(
      `Insufficient cash. Need PKR ${Math.abs(netCash).toFixed(0)}, have PKR ${portfolio.cashBalance.toFixed(0)}`
    );
  }

  for (const { trade, total, fees: tradeFees } of priced) {
    const existingIdx = portfolio.holdings.findIndex((h) => h.symbol === trade.symbol);
    // Cost basis before this row changes it, for realized P&L on a sell.
    const avgBefore = existingIdx >= 0 ? portfolio.holdings[existingIdx].avgPrice : 0;

    if (trade.type === "BUY") {
      if (existingIdx >= 0) {
        const existing = portfolio.holdings[existingIdx];
        const newQty = existing.quantity + trade.quantity;
        portfolio.holdings[existingIdx] = {
          ...existing,
          quantity: newQty,
          // Cost basis includes fees.
          avgPrice: (existing.avgPrice * existing.quantity + total) / newQty,
          updatedAt: now,
        };
      } else {
        portfolio.holdings.push({
          id: newId(),
          symbol: trade.symbol,
          companyName: trade.companyName,
          quantity: trade.quantity,
          avgPrice: total / trade.quantity,
          createdAt: now,
          updatedAt: now,
        });
      }
    } else if (existingIdx >= 0) {
      const existing = portfolio.holdings[existingIdx];
      const newQty = existing.quantity - trade.quantity;
      if (newQty <= 0) portfolio.holdings.splice(existingIdx, 1);
      else portfolio.holdings[existingIdx] = { ...existing, quantity: newQty, updatedAt: now };
    }

    portfolio.transactions.push({
      id: newId(),
      type: trade.type,
      symbol: trade.symbol,
      companyName: trade.companyName,
      quantity: trade.quantity,
      price: trade.price,
      total,
      portfolioId,
      createdAt: now,
      ...(trade.type === "SELL"
        ? { realizedPnl: round2(total - avgBefore * trade.quantity) }
        : {}),
      ...(tradeFees > 0 ? { fees: tradeFees } : {}),
    });
  }

  portfolio.cashBalance = round2(portfolio.cashBalance + netCash);
  portfolio.updatedAt = now;
  return { portfolio, totalFees, netCash };
}
