"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { formatPKR } from "@/lib/market-status";

type TypeFilter = "all" | "BUY" | "SELL" | "CASH_IN" | "CASH_OUT" | "SPLIT";
type PeriodFilter = "all" | "fy" | "cy" | "custom";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "BUY", label: "Buy" },
  { value: "SELL", label: "Sell" },
  { value: "CASH_IN", label: "Cash In" },
  { value: "CASH_OUT", label: "Cash Out" },
  { value: "SPLIT", label: "Split" },
];

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "fy", label: "This fiscal year" },
  { value: "cy", label: "This calendar year" },
  { value: "custom", label: "Custom range" },
];

/**
 * Date range [from, to] in ms for the selected period, or null for "all time".
 * Pakistan fiscal year runs 1 Jul → 30 Jun. Runs client-side only.
 */
function periodRange(
  period: PeriodFilter,
  from: string,
  to: string
): { from: number; to: number } | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "cy") {
    const y = now.getFullYear();
    return {
      from: new Date(y, 0, 1).getTime(),
      to: new Date(y, 11, 31, 23, 59, 59, 999).getTime(),
    };
  }
  if (period === "fy") {
    const y = now.getFullYear();
    const startYear = now.getMonth() >= 6 ? y : y - 1; // month 6 = July
    return {
      from: new Date(startYear, 6, 1).getTime(),
      to: new Date(startYear + 1, 5, 30, 23, 59, 59, 999).getTime(),
    };
  }
  // custom
  return {
    from: from ? new Date(`${from}T00:00:00`).getTime() : -Infinity,
    to: to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity,
  };
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
  portfolioName?: string;
  source?: "portfolio" | "model";
  createdAt: string;
  realizedPnl?: number;
  fees?: number;
}

interface Portfolio {
  id: string;
  name: string;
}

const TINTS = ["#2563EB", "#7C3AED", "#0D9488", "#DB2777", "#CA8A04", "#0891B2", "#16A34A", "#4F46E5"];
/** Badge label + colors per transaction type (BUY/SELL/CASH/SPLIT). */
function txBadge(type: string): { label: string; color: string; bg: string } {
  switch (type) {
    case "BUY":
      return { label: "BUY", color: "var(--color-gain)", bg: "var(--color-gain-50)" };
    case "SELL":
      return { label: "SELL", color: "var(--color-loss-strong)", bg: "var(--color-loss-50)" };
    case "CASH_IN":
      return { label: "CASH IN", color: "#2563EB", bg: "#2563EB1e" };
    case "CASH_OUT":
      return { label: "CASH OUT", color: "#CA8A04", bg: "#CA8A041e" };
    case "SPLIT":
      return { label: "SPLIT", color: "#7C3AED", bg: "#7C3AED1e" };
    default:
      return { label: type, color: "var(--color-ink-2)", bg: "var(--color-line-soft)" };
  }
}

function tint(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [models, setModels] = useState<Portfolio[]>([]);
  const [filterPortfolio, setFilterPortfolio] = useState("all");
  const [filterType, setFilterType] = useState<TypeFilter>("all");
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterSymbol, setFilterSymbol] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const portfolioParam =
      filterPortfolio !== "all" ? `?portfolioId=${filterPortfolio}` : "";
    const [txRes, portfolioRes, modelRes] = await Promise.all([
      fetch(`/api/transactions${portfolioParam}`),
      fetch("/api/portfolios"),
      fetch("/api/model-portfolios"),
    ]);

    if (txRes.ok) setTransactions(await txRes.json());
    if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
    if (modelRes.ok) {
      const data = await modelRes.json();
      setModels(Array.isArray(data) ? data : []);
    }
    setInitialLoading(false);
  }, [filterPortfolio]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filters: type, period (fiscal/calendar/custom), and stock symbol.
  const filtered = useMemo(() => {
    let rows = transactions;
    if (filterType !== "all") rows = rows.filter((t) => t.type === filterType);
    const q = filterSymbol.trim().toUpperCase();
    if (q) rows = rows.filter((t) => t.symbol.toUpperCase().includes(q));
    const range = periodRange(filterPeriod, customFrom, customTo);
    if (range) {
      rows = rows.filter((t) => {
        const d = new Date(t.createdAt).getTime();
        return d >= range.from && d <= range.to;
      });
    }
    return rows;
  }, [transactions, filterType, filterSymbol, filterPeriod, customFrom, customTo]);

  const filtersActive =
    filterType !== "all" ||
    filterPeriod !== "all" ||
    filterSymbol.trim() !== "";
  const clearFilters = () => {
    setFilterType("all");
    setFilterPeriod("all");
    setCustomFrom("");
    setCustomTo("");
    setFilterSymbol("");
  };

  // Realized P&L across the shown (filtered) SELL transactions.
  const realizedTotal = filtered.reduce(
    (sum, t) => sum + (t.type === "SELL" ? t.realizedPnl ?? 0 : 0),
    0
  );
  const sellCount = filtered.filter((t) => t.type === "SELL").length;
  const realizedUp = realizedTotal >= 0;

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            {filtered.length}
            {filtersActive ? ` of ${transactions.length}` : ""}{" "}
            {filtered.length === 1 ? "record" : "records"}
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">Transactions</h1>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
        {/* Portfolio (server-filtered) */}
        <FilterSelect
          value={filterPortfolio}
          onChange={setFilterPortfolio}
        >
          <option value="all">All Portfolios</option>
          {portfolios.length > 0 && (
            <optgroup label="Personal">
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
          {models.length > 0 && (
            <optgroup label="Models">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          )}
        </FilterSelect>

        {/* Type */}
        <FilterSelect
          value={filterType}
          onChange={(v) => setFilterType(v as TypeFilter)}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FilterSelect>

        {/* Period */}
        <FilterSelect
          value={filterPeriod}
          onChange={(v) => setFilterPeriod(v as PeriodFilter)}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FilterSelect>

        {/* Custom date range */}
        {filterPeriod === "custom" && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="num h-10 rounded-[10px] border border-line bg-card px-2.5 text-[13px] shadow-card outline-none focus:border-brand"
            />
            <span className="text-[12px] text-ink-3">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="num h-10 rounded-[10px] border border-line bg-card px-2.5 text-[13px] shadow-card outline-none focus:border-brand"
            />
          </div>
        )}

        {/* Stock symbol search */}
        <label className="relative flex min-w-[160px] flex-1 items-center sm:max-w-[220px]">
          <Search className="absolute left-3 h-[15px] w-[15px] opacity-50" />
          <input
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            placeholder="Filter by stock…"
            className="h-10 w-full rounded-[10px] border border-line bg-card pl-9 pr-3 text-[13px] shadow-card outline-none focus:border-brand"
          />
        </label>

        {filtersActive && (
          <button
            onClick={clearFilters}
            className="flex h-10 items-center gap-1.5 rounded-[10px] border border-line bg-card px-3 text-[13px] font-medium text-ink-2 shadow-card hover:bg-ink/[.04]"
          >
            <X className="h-[14px] w-[14px]" /> Clear
          </button>
        )}
      </div>

      {/* Realized P&L summary */}
      {sellCount > 0 && (
        <div className="mb-[18px] rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="text-[12px] font-medium text-ink-2">Realized P&amp;L</div>
          <div
            className="num money mt-1 text-[26px] font-bold tracking-[-.025em]"
            style={{ color: realizedUp ? "var(--color-gain)" : "var(--color-loss-strong)" }}
          >
            {realizedUp ? "+" : "−"}Rs {formatPKR(Math.abs(realizedTotal), { decimals: 0 })}
          </div>
          <div className="mt-1 text-[12px] text-ink-3">
            Booked across {sellCount} sell{sellCount !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Table */}
      <section className="rounded-2xl border border-line bg-card pb-2 pt-[22px] shadow-card">
        <div className="grid grid-cols-[86px_1.3fr_1fr_.7fr_.9fr_1fr_1fr] gap-2 border-b border-line px-[22px] pb-2.5 text-[11px] font-semibold tracking-[.03em] text-ink-3">
          <span>TYPE</span>
          <span>STOCK</span>
          <span>PORTFOLIO</span>
          <span className="text-right">QTY</span>
          <span className="text-right">PRICE</span>
          <span className="text-right">TOTAL</span>
          <span className="text-right">REALIZED</span>
        </div>

        {initialLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[86px_1.3fr_1fr_.7fr_.9fr_1fr_1fr] gap-2 border-b border-line-soft px-[22px] py-[11px]"
            >
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="h-4 animate-pulse rounded bg-line-soft" />
              ))}
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-ink-2">
              {transactions.length === 0 ? "No transactions yet" : "No matching transactions"}
            </p>
            <p className="mt-1 text-xs text-ink-3">
              {transactions.length === 0
                ? "Start trading from the Market or Portfolio page"
                : "Try adjusting or clearing your filters"}
            </p>
          </div>
        ) : (
          filtered.map((tx) => {
            const c = tint(tx.symbol);
            const badge = txBadge(tx.type);
            const isCash = tx.type === "CASH_IN" || tx.type === "CASH_OUT";
            const label = isCash ? "Cash" : tx.symbol;
            const initials = isCash ? "Rs" : tx.symbol.slice(0, 2);
            const stockInner = (
              <>
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[12px] font-bold"
                  style={
                    isCash
                      ? { background: "var(--color-line-soft)", color: "var(--color-ink-3)" }
                      : { background: `${c}22`, color: c }
                  }
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{label}</div>
                  <div className="text-[11px] text-ink-3">
                    {format(new Date(tx.createdAt), "dd MMM yyyy")}
                  </div>
                </div>
              </>
            );
            return (
              <div
                key={tx.id}
                className="grid grid-cols-[86px_1.3fr_1fr_.7fr_.9fr_1fr_1fr] items-center gap-2 border-b border-line-soft px-[22px] py-[11px] hover:bg-ink/[.03]"
              >
                <span
                  className="num justify-self-start rounded-md px-1.5 py-[3px] text-[10px] font-bold tracking-[.03em]"
                  style={{ color: badge.color, background: badge.bg }}
                >
                  {badge.label}
                </span>
                {isCash ? (
                  <div className="flex min-w-0 items-center gap-2.5">{stockInner}</div>
                ) : (
                  <Link href={`/stock/${tx.symbol}`} className="flex min-w-0 items-center gap-2.5">
                    {stockInner}
                  </Link>
                )}
                <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-2">
                  <span className="truncate">{tx.portfolioName || "—"}</span>
                  {tx.source === "model" && (
                    <span className="shrink-0 rounded bg-brand/10 px-1 py-[1px] text-[9px] font-bold uppercase text-brand">
                      Model
                    </span>
                  )}
                </span>
                <span className="num text-right text-[12.5px]">
                  {isCash ? <span className="text-ink-3">—</span> : tx.quantity.toLocaleString()}
                </span>
                <span className="num text-right text-[12.5px]">
                  {isCash ? (
                    <span className="text-ink-3">—</span>
                  ) : (
                    formatPKR(tx.price, { decimals: 1 })
                  )}
                </span>
                <span className="num money text-right text-[12.5px] font-semibold">
                  Rs {formatPKR(tx.total, { decimals: 0 })}
                  {tx.fees ? (
                    <span className="block text-[10.5px] font-normal text-ink-3">
                      incl. Rs {formatPKR(tx.fees)} fees
                    </span>
                  ) : null}
                </span>
                <span className="num money text-right text-[12.5px] font-semibold">
                  {tx.type === "SELL" && tx.realizedPnl !== undefined ? (
                    <span
                      style={{
                        color: tx.realizedPnl >= 0 ? "var(--color-gain)" : "var(--color-loss-strong)",
                      }}
                    >
                      {tx.realizedPnl >= 0 ? "+" : "−"}
                      {formatPKR(Math.abs(tx.realizedPnl), { decimals: 0 })}
                    </span>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </span>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}

/** Styled native <select> with a chevron, used for the filter bar. */
function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-[10px] border border-line bg-card pl-3.5 pr-9 text-[13px] font-medium shadow-card outline-none focus:border-brand"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
    </div>
  );
}
