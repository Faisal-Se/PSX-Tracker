"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  X,
  Calculator,
} from "lucide-react";
import { formatPKR } from "@/lib/market-status";
import { StockSearch } from "@/components/StockSearch";
import { ChartSkeleton, Skeleton } from "@/components/ui/skeleton";

/* ────────────────────────── types ────────────────────────── */

interface Allocation {
  symbol: string;
  companyName: string;
  percentage: number;
  shares: number;
  avgPrice: number;
}
interface ModelPortfolio {
  id: string;
  name: string;
  cashBalance: number;
  allocations: Allocation[];
}
interface MarketStock {
  symbol: string;
  company?: string;
  current: number;
}

type Mode = "new" | "rebalance";

interface Row {
  symbol: string;
  companyName: string;
  isCash: boolean;
  weight: string; // % (editable)
  price: string; // PKR (editable, snapshot from market)
  currentShares: number; // held today (for rebalance); cash amount for CASH row
}

const TINTS = ["#2563EB", "#7C3AED", "#0D9488", "#DB2777", "#CA8A04", "#0891B2", "#16A34A", "#4F46E5"];
function tint(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

const QUICK_AMOUNTS = [200000, 500000, 1000000, 2000000, 5000000];

/* ────────────────────────── page ────────────────────────── */

export default function BuyPlanPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [modelName, setModelName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [amount, setAmount] = useState("1000000");
  const [mode, setMode] = useState<Mode>("new");
  const [refreshing, setRefreshing] = useState(false);

  // Load model + market ONCE. Prices are a snapshot — no live polling here.
  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const [modelRes, marketRes] = await Promise.all([
          fetch(`/api/model-portfolios/${id}`),
          fetch("/api/psx"),
        ]);
        const priceMap = new Map<string, number>();
        const companyMap = new Map<string, string>();
        if (marketRes.ok) {
          const data: MarketStock[] = await marketRes.json();
          if (Array.isArray(data))
            for (const s of data) {
              priceMap.set(s.symbol, s.current);
              if (s.company) companyMap.set(s.symbol, s.company);
            }
        }

        if (isRefresh) {
          // Refresh ONLY re-pulls prices into the Price column.
          setRows((prev) =>
            prev.map((r) =>
              r.isCash
                ? r
                : { ...r, price: String(priceMap.get(r.symbol) ?? r.price) }
            )
          );
          return;
        }

        if (modelRes.ok) {
          const m: ModelPortfolio = await modelRes.json();
          setModelName(m.name);
          const stockRows: Row[] = m.allocations
            .filter((a) => a.symbol !== "CASH")
            .map((a) => ({
              symbol: a.symbol,
              companyName: companyMap.get(a.symbol) || a.companyName,
              isCash: false,
              weight: String(a.percentage ?? 0),
              price: String(priceMap.get(a.symbol) ?? a.avgPrice ?? 0),
              currentShares: a.shares,
            }));
          const cashAlloc = m.allocations.find((a) => a.symbol === "CASH");
          const cashRow: Row = {
            symbol: "CASH",
            companyName: "Cash",
            isCash: true,
            weight: String(cashAlloc?.percentage ?? 0),
            price: "1",
            currentShares: m.cashBalance,
          };
          setRows([cashRow, ...stockRows]);

          // Default the amount to the model's current market value.
          const mktValue =
            m.cashBalance +
            m.allocations
              .filter((a) => a.symbol !== "CASH")
              .reduce((s, a) => s + a.shares * (priceMap.get(a.symbol) ?? a.avgPrice), 0);
          if (mktValue > 0) setAmount(String(Math.round(mktValue)));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const setRow = (symbol: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.symbol === symbol ? { ...r, ...patch } : r)));
  const removeRow = (symbol: string) =>
    setRows((prev) => prev.filter((r) => r.symbol !== symbol));
  const addStock = (s: { symbol: string; company: string; current: number }) => {
    if (rows.some((r) => r.symbol === s.symbol)) return;
    setRows((prev) => [
      ...prev,
      {
        symbol: s.symbol,
        companyName: s.company,
        isCash: false,
        weight: "0",
        price: String(s.current || 0),
        currentShares: 0,
      },
    ]);
  };

  /* ── calculations ── */
  const amt = parseFloat(amount) || 0;

  const computed = useMemo(() => {
    return rows.map((r) => {
      const weight = parseFloat(r.weight) || 0;
      const price = parseFloat(r.price) || 0;
      const targetAmount = amt * (weight / 100);
      const targetShares = price > 0 ? Math.floor(targetAmount / price) : 0;
      const cost = targetShares * price;
      const delta = targetShares - r.currentShares; // + buy, − sell
      const deltaCost = delta * price;
      return { ...r, weight, price, targetShares, cost, delta, deltaCost };
    });
  }, [rows, amt]);

  const weightSum = computed.reduce((s, r) => s + r.weight, 0);
  const totalCost = computed.reduce((s, r) => s + r.cost, 0);
  const leftover = amt - totalCost;
  const totalBuy = computed.reduce((s, r) => s + (r.delta > 0 ? r.deltaCost : 0), 0);
  const totalSell = computed.reduce((s, r) => s + (r.delta < 0 ? -r.deltaCost : 0), 0);
  const netCash = totalBuy - totalSell;

  const weightOk = Math.abs(weightSum - 100) < 0.5;

  if (loading) {
    return (
      <>
        <div className="mb-5 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-7 w-56" />
        </div>
        <Skeleton className="mb-[18px] h-[92px] rounded-2xl" />
        <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <ChartSkeleton height={320} />
        </div>
      </>
    );
  }

  const gridNew = "grid-cols-[minmax(140px,1.4fr)_96px_120px_96px_1.1fr_40px]";
  const gridReb = "grid-cols-[minmax(140px,1.4fr)_96px_120px_84px_84px_1.2fr_40px]";
  const grid = mode === "new" ? gridNew : gridReb;

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/models/${id}`}
            className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-card text-ink-2 shadow-card hover:bg-ink/[.04]"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </Link>
          <div>
            <div className="mb-0.5 flex items-center gap-2 text-[13px] font-medium text-ink-3">
              <Calculator className="h-[15px] w-[15px]" /> Allocation Calculator
            </div>
            <h1 className="text-[24px] font-bold tracking-[-.02em]">{modelName}</h1>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04] disabled:opacity-60"
          title="Re-pull current market prices"
        >
          <RefreshCw className={`h-[15px] w-[15px] ${refreshing ? "animate-spin" : ""}`} />
          Refresh prices
        </button>
      </div>

      {/* Mode toggle */}
      <div className="mb-[18px] inline-flex gap-1 rounded-[12px] border border-line bg-canvas p-1 shadow-card">
        {(
          [
            { v: "new", label: "New Investment" },
            { v: "rebalance", label: "Rebalance Existing" },
          ] as { v: Mode; label: string }[]
        ).map((m) => (
          <button
            key={m.v}
            onClick={() => setMode(m.v)}
            className={`rounded-[9px] px-4 py-1.5 text-[13px] font-semibold transition-colors ${
              mode === m.v ? "bg-brand text-white shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div className="mb-[18px] rounded-2xl border border-line bg-card p-[22px] shadow-card">
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[.04em] text-ink-3">
          {mode === "new" ? "How much do you want to invest?" : "Portfolio value to rebalance"}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-bold text-ink-2">PKR</span>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="num h-11 w-[180px] rounded-[10px] border border-line bg-canvas px-3.5 text-[18px] font-bold outline-none focus:border-brand"
            />
          </div>
          {mode === "new" && (
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  onClick={() => setAmount(String(q))}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    amt === q
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-card text-ink-2 hover:bg-ink/[.04]"
                  }`}
                >
                  {q.toLocaleString()}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1" />
          <span
            className="num rounded-lg px-2.5 py-1 text-[12px] font-semibold"
            style={{
              color: weightOk ? "var(--color-gain)" : "var(--color-loss-strong)",
              background: weightOk ? "var(--color-gain-50)" : "var(--color-loss-50)",
            }}
          >
            Weights total {weightSum.toFixed(1)}%
          </span>
        </div>
        <p className="mt-2.5 text-[12px] text-ink-3">
          Enter the current market price for each stock to generate your{" "}
          {mode === "new" ? "buy plan" : "rebalance plan"}. Prices are a snapshot — edit
          them freely, or hit <span className="font-semibold text-ink-2">Refresh prices</span> to
          re-pull the live market rate.
        </p>
      </div>

      {/* Table */}
      <section className="overflow-x-auto rounded-2xl border border-line bg-card pb-2 pt-[22px] shadow-card">
        <div className="min-w-[720px]">
          {/* head */}
          <div
            className={`grid ${grid} items-center gap-2 border-b border-line px-[22px] pb-2.5 text-[11px] font-semibold tracking-[.03em] text-ink-3`}
          >
            <span>STOCK</span>
            <span>WEIGHT %</span>
            <span>PRICE (PKR)</span>
            {mode === "new" ? (
              <>
                <span className="text-right">SHARES</span>
                <span className="text-right">COST (PKR)</span>
              </>
            ) : (
              <>
                <span className="text-right">CURRENT</span>
                <span className="text-right">TARGET</span>
                <span className="text-right">ACTION</span>
              </>
            )}
            <span />
          </div>

          {/* rows */}
          {computed.map((r) => {
            const c = tint(r.symbol);
            return (
              <div
                key={r.symbol}
                className={`grid ${grid} items-center gap-2 border-b border-line-soft px-[22px] py-2.5 hover:bg-ink/[.03]`}
              >
                {/* stock */}
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: r.isCash ? "#CA8A04" : c }}
                  />
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold">{r.symbol}</div>
                    <div className="truncate text-[11px] text-ink-3">{r.companyName}</div>
                  </div>
                </div>

                {/* weight */}
                <input
                  type="number"
                  min="0"
                  value={r.weight}
                  onChange={(e) => setRow(r.symbol, { weight: e.target.value })}
                  className="num h-9 w-full rounded-[10px] border border-line bg-canvas px-2.5 text-[13px] outline-none focus:border-brand"
                />

                {/* price */}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={r.price}
                  disabled={r.isCash}
                  onChange={(e) => setRow(r.symbol, { price: e.target.value })}
                  className="num h-9 w-full rounded-[10px] border border-line bg-canvas px-2.5 text-[13px] outline-none focus:border-brand disabled:opacity-60"
                />

                {mode === "new" ? (
                  <>
                    <span className="num text-right text-[13px] font-semibold text-gain">
                      {r.targetShares.toLocaleString()}
                    </span>
                    <span className="num text-right text-[13px] font-semibold">
                      {formatPKR(r.cost, { decimals: r.cost < 1000 ? 1 : 0 })}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="num text-right text-[12.5px] text-ink-2">
                      {r.isCash
                        ? `Rs ${formatPKR(r.currentShares, { decimals: 0 })}`
                        : r.currentShares.toLocaleString()}
                    </span>
                    <span className="num text-right text-[12.5px] font-semibold">
                      {r.isCash
                        ? `Rs ${formatPKR(r.targetShares, { decimals: 0 })}`
                        : r.targetShares.toLocaleString()}
                    </span>
                    <span className="flex items-center justify-end">
                      {Math.abs(r.delta) < 1 ? (
                        <span className="text-[12px] text-ink-3">—</span>
                      ) : (
                        <span
                          className="num rounded-lg px-2 py-1 text-[12px] font-semibold"
                          style={{
                            color: r.delta > 0 ? "var(--color-gain)" : "var(--color-loss-strong)",
                            background:
                              r.delta > 0 ? "var(--color-gain-50)" : "var(--color-loss-50)",
                          }}
                        >
                          {r.delta > 0 ? "BUY " : "SELL "}
                          {r.isCash
                            ? `Rs ${formatPKR(Math.abs(r.deltaCost), { decimals: 0 })}`
                            : `${Math.abs(r.delta).toLocaleString()} sh`}
                        </span>
                      )}
                    </span>
                  </>
                )}

                {/* remove */}
                <button
                  onClick={() => removeRow(r.symbol)}
                  title="Remove"
                  className="grid h-7 w-7 place-items-center justify-self-end rounded-full bg-loss-strong/10 text-loss-strong hover:bg-loss-strong/20"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          {/* add stock */}
          <div className="px-[22px] py-3">
            <StockSearch onSelect={addStock} placeholder="+ Add stock to the plan…" />
          </div>
        </div>
      </section>

      {/* Totals footer */}
      <div className="mt-[18px] grid gap-[18px] sm:grid-cols-3">
        {mode === "new" ? (
          <>
            <Stat label="Total cost" value={`Rs ${formatPKR(totalCost, { decimals: 0 })}`} />
            <Stat
              label="Leftover cash"
              value={`Rs ${formatPKR(Math.max(0, leftover), { decimals: 0 })}`}
              tone={leftover < -0.5 ? "loss" : "default"}
            />
            <Stat
              label="Positions"
              value={String(computed.filter((r) => !r.isCash && r.targetShares > 0).length)}
            />
          </>
        ) : (
          <>
            <Stat label="To buy" value={`Rs ${formatPKR(totalBuy, { decimals: 0 })}`} tone="gain" />
            <Stat label="To sell" value={`Rs ${formatPKR(totalSell, { decimals: 0 })}`} tone="loss" />
            <Stat
              label="Net cash needed"
              value={`${netCash >= 0 ? "" : "−"}Rs ${formatPKR(Math.abs(netCash), { decimals: 0 })}`}
              tone={netCash > 0 ? "loss" : "gain"}
            />
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-3">
        <Plus className="h-3.5 w-3.5" />
        This is a planning tool — nothing is bought or sold. Use it to work out your{" "}
        {mode === "new" ? "buy" : "rebalance"} orders, then place them yourself.
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "gain" | "loss";
}) {
  const color =
    tone === "gain"
      ? "var(--color-gain)"
      : tone === "loss"
        ? "var(--color-loss-strong)"
        : "var(--color-ink)";
  return (
    <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
      <div className="text-[12px] font-medium text-ink-2">{label}</div>
      <div className="num mt-1 text-[24px] font-bold tracking-[-.025em]" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
