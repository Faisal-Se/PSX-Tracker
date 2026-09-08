/**
 * Trading cost model for PSX trades.
 *
 * Pure and dependency-free so the same arithmetic runs on the server (where a
 * trade is booked) and in the browser (where it is previewed): the number the
 * user sees before confirming is the number that gets stored.
 *
 * Every rate defaults to 0, which disables fees entirely. Behaviour is
 * unchanged until the user enters their broker's rates in Settings.
 */

export interface FeeSettings {
  /** Brokerage commission as a % of trade value (e.g. 0.15). */
  commissionPct: number;
  /** Commission floor in Rs per share; commission = max(pct, this × shares). */
  minCommissionPerShare: number;
  /** Sales tax charged on the commission, as a % of it (e.g. 13 for Sindh). */
  sstPct: number;
  /** CDC, SECP and exchange levies as a % of trade value (e.g. 0.005). */
  leviesPct: number;
}

export const ZERO_FEES: FeeSettings = {
  commissionPct: 0,
  minCommissionPerShare: 0,
  sstPct: 0,
  leviesPct: 0,
};

/** Typical PSX retail-broker rates; shown as placeholders, never applied unasked. */
export const TYPICAL_PSX_FEES: FeeSettings = {
  commissionPct: 0.15,
  minCommissionPerShare: 0.03,
  sstPct: 13,
  leviesPct: 0.005,
};

/** Upper bounds that catch a mistyped rate (e.g. 15 instead of 0.15). */
export const FEE_LIMITS: Record<keyof FeeSettings, number> = {
  commissionPct: 5,
  minCommissionPerShare: 5,
  sstPct: 30,
  leviesPct: 1,
};

export const FEE_KEYS = Object.keys(ZERO_FEES) as (keyof FeeSettings)[];

/** Coerce anything (stored JSON, a request body) into a safe FeeSettings. */
export function normalizeFeeSettings(raw: unknown): FeeSettings {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof FeeSettings, unknown>
  >;
  const out: FeeSettings = { ...ZERO_FEES };
  for (const k of FEE_KEYS) {
    const n = Number(src[k]);
    out[k] = Number.isFinite(n) && n >= 0 ? Math.min(n, FEE_LIMITS[k]) : 0;
  }
  return out;
}

export function feesEnabled(s: FeeSettings): boolean {
  return s.commissionPct > 0 || s.minCommissionPerShare > 0 || s.leviesPct > 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface FeeBreakdown {
  commission: number;
  sst: number;
  levies: number;
  total: number;
}

/** Fees on one trade, each component rounded to the paisa. */
export function tradeFees(shares: number, price: number, s: FeeSettings): FeeBreakdown {
  if (!(shares > 0) || !(price > 0)) {
    return { commission: 0, sst: 0, levies: 0, total: 0 };
  }
  const value = shares * price;
  const commission = round2(
    Math.max((value * s.commissionPct) / 100, shares * s.minCommissionPerShare)
  );
  const sst = round2((commission * s.sstPct) / 100);
  const levies = round2((value * s.leviesPct) / 100);
  return { commission, sst, levies, total: round2(commission + sst + levies) };
}

/** Cash out the door on a BUY, and the resulting all-in price per share. */
export function buyCost(shares: number, price: number, s: FeeSettings) {
  const gross = round2(shares * price);
  const fees = tradeFees(shares, price, s).total;
  const total = round2(gross + fees);
  return { gross, fees, total, effectivePrice: shares > 0 ? total / shares : 0 };
}

/** Cash received on a SELL after fees. */
export function sellProceeds(shares: number, price: number, s: FeeSettings) {
  const gross = round2(shares * price);
  const fees = tradeFees(shares, price, s).total;
  return { gross, fees, net: round2(gross - fees) };
}

/**
 * Largest whole number of shares whose all-in buy cost fits `budget`.
 * With zero fees this is simply floor(budget / price).
 */
export function maxAffordableShares(budget: number, price: number, s: FeeSettings): number {
  if (!(budget > 0) || !(price > 0)) return 0;
  let n = Math.floor(budget / price);
  while (n > 0 && buyCost(n, price, s).total > budget) n--;
  return n;
}
