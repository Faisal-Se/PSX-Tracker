"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { formatPKR } from "@/lib/market-status";

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
  const [filterPortfolio, setFilterPortfolio] = useState("all");
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const portfolioParam =
      filterPortfolio !== "all" ? `?portfolioId=${filterPortfolio}` : "";
    const [txRes, portfolioRes] = await Promise.all([
      fetch(`/api/transactions${portfolioParam}`),
      fetch("/api/portfolios"),
    ]);

    if (txRes.ok) setTransactions(await txRes.json());
    if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
    setInitialLoading(false);
  }, [filterPortfolio]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const portfolioMap = new Map(portfolios.map((p) => [p.id, p.name]));

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            {transactions.length} {transactions.length === 1 ? "record" : "records"}
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">Transactions</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              value={filterPortfolio}
              onChange={(e) => setFilterPortfolio(e.target.value)}
              className="h-10 appearance-none rounded-[10px] border border-line bg-card pl-3.5 pr-9 text-[13px] font-medium shadow-card outline-none focus:border-brand"
            >
              <option value="all">All Portfolios</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
          </div>
        </div>
      </div>

      {/* Table */}
      <section className="rounded-2xl border border-line bg-card pb-2 pt-[22px] shadow-card">
        <div className="grid grid-cols-[92px_1.4fr_1.2fr_.8fr_1fr_1.1fr] gap-2 border-b border-line px-[22px] pb-2.5 text-[11px] font-semibold tracking-[.03em] text-ink-3">
          <span>TYPE</span>
          <span>STOCK</span>
          <span>PORTFOLIO</span>
          <span className="text-right">QTY</span>
          <span className="text-right">PRICE</span>
          <span className="text-right">TOTAL</span>
        </div>

        {initialLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[92px_1.4fr_1.2fr_.8fr_1fr_1.1fr] gap-2 border-b border-line-soft px-[22px] py-[11px]"
            >
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="h-4 animate-pulse rounded bg-line-soft" />
              ))}
            </div>
          ))
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-ink-2">No transactions yet</p>
            <p className="mt-1 text-xs text-ink-3">
              Start trading from the Market or Portfolio page
            </p>
          </div>
        ) : (
          transactions.map((tx) => {
            const c = tint(tx.symbol);
            const badge = txBadge(tx.type);
            return (
              <div
                key={tx.id}
                className="grid grid-cols-[92px_1.4fr_1.2fr_.8fr_1fr_1.1fr] items-center gap-2 border-b border-line-soft px-[22px] py-[11px] hover:bg-ink/[.03]"
              >
                <span
                  className="num justify-self-start rounded-md px-1.5 py-[3px] text-[10px] font-bold tracking-[.03em]"
                  style={{ color: badge.color, background: badge.bg }}
                >
                  {badge.label}
                </span>
                <Link href={`/stock/${tx.symbol}`} className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[12px] font-bold"
                    style={{ background: `${c}22`, color: c }}
                  >
                    {tx.symbol.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{tx.symbol}</div>
                    <div className="text-[11px] text-ink-3">
                      {format(new Date(tx.createdAt), "dd MMM yyyy")}
                    </div>
                  </div>
                </Link>
                <span className="truncate text-[12.5px] text-ink-2">
                  {portfolioMap.get(tx.portfolioId) || "—"}
                </span>
                <span className="num text-right text-[12.5px]">
                  {tx.quantity.toLocaleString()}
                </span>
                <span className="num text-right text-[12.5px]">
                  {formatPKR(tx.price, { decimals: 1 })}
                </span>
                <span className="num text-right text-[12.5px] font-semibold">
                  Rs {formatPKR(tx.total, { decimals: 0 })}
                </span>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
