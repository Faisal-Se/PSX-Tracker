"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Layers,
  X,
  Search,
  Hash,
  Percent,
} from "lucide-react";
import { formatPKR } from "@/lib/market-status";
import { Sparkline } from "@/components/Sparkline";
import { PageSkeleton } from "@/components/ui/skeleton";

/* Chart palette (allocation bars, NOT P&L) */
const ALLOC_COLORS = ["#7C3AED", "#0D9488", "#2563EB", "#0891B2", "#CA8A04", "#DB2777"];
const CASH_COLOR = "#CBD5E1";

interface Allocation {
  id?: string;
  symbol: string;
  companyName: string;
  percentage: number;
  shares: number;
  avgPrice: number;
}

interface ModelPortfolio {
  id: string;
  name: string;
  description: string;
  cashBalance: number;
  allocations: Allocation[];
  createdAt: string;
}

interface SearchStock {
  symbol: string;
  company: string;
  current: number;
}

interface HistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function ModelsPage() {
  const router = useRouter();
  const [models, setModels] = useState<ModelPortfolio[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  // Live prices + per-symbol history for card metrics
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});

  // Editor form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCash, setFormCash] = useState("");
  const [allocations, setAllocations] = useState<
    { symbol: string; companyName: string; percentage: number; customPrice?: number; inputShares?: number }[]
  >([{ symbol: "CASH", companyName: "Cash Reserve", percentage: 100 }]);

  // Stock search
  const [stockQuery, setStockQuery] = useState("");
  const [stockResults, setStockResults] = useState<SearchStock[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Market prices for preview
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});

  // Raw string values for buy price inputs (so user can clear/type freely)
  const [customPriceInputs, setCustomPriceInputs] = useState<Record<string, string>>({});

  // Allocation mode: percent or shares
  const [allocMode, setAllocMode] = useState<"percent" | "shares">("percent");

  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/model-portfolios");
      if (res.ok) setModels(await res.json());
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live market prices for card P&L / cash% metrics
  useEffect(() => {
    let cancelled = false;
    fetch("/api/psx")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { symbol: string; current: number }[]) => {
        if (cancelled || !Array.isArray(data)) return;
        setPriceMap(new Map(data.map((s) => [s.symbol, s.current])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Per-symbol price history for the card sparkline trend
  const modelSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const m of models)
      for (const a of m.allocations)
        if (a.symbol !== "CASH" && a.shares > 0) set.add(a.symbol);
    return Array.from(set).slice(0, 24);
  }, [models]);

  useEffect(() => {
    if (modelSymbols.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        modelSymbols.map(async (sym) => {
          try {
            const res = await fetch(`/api/psx/history?symbol=${encodeURIComponent(sym)}`);
            if (!res.ok) return [sym, [] as HistoryPoint[]] as const;
            const data = (await res.json()) as HistoryPoint[];
            return [sym, Array.isArray(data) ? data : []] as const;
          } catch {
            return [sym, [] as HistoryPoint[]] as const;
          }
        })
      );
      if (cancelled) return;
      const map: Record<string, HistoryPoint[]> = {};
      for (const [sym, data] of results) map[sym] = data;
      setHistory(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [modelSymbols]);

  // Per-model metrics + trend (mirrors the dashboard's model card data).
  const modelMetrics = useMemo(() => {
    return models.map((m) => {
      const stocks = m.allocations.filter((a) => a.symbol !== "CASH");
      let invested = 0;
      let marketValue = 0;
      for (const a of stocks) {
        const cur = priceMap.get(a.symbol) || a.avgPrice;
        invested += a.avgPrice * a.shares;
        marketValue += cur * a.shares;
      }
      const total = marketValue + m.cashBalance;
      const pnl = marketValue - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
      const stockCount = stocks.filter((a) => a.shares > 0).length;
      const cashPct = total > 0 ? (m.cashBalance / total) * 100 : 0;

      const dateSet = new Set<string>();
      for (const a of stocks)
        for (const pt of history[a.symbol] || []) dateSet.add(pt.date);
      const dates = Array.from(dateSet).sort().slice(-24);
      const sorted: Record<string, HistoryPoint[]> = {};
      for (const a of stocks)
        sorted[a.symbol] = [...(history[a.symbol] || [])].sort((x, y) =>
          x.date < y.date ? -1 : 1
        );
      const trend = dates.map((d) => {
        let v = m.cashBalance;
        for (const a of stocks) {
          const hist = sorted[a.symbol] || [];
          let close = a.avgPrice;
          for (const pt of hist) {
            if (pt.date <= d && pt.close > 0) close = pt.close;
            else if (pt.date > d) break;
          }
          v += close * a.shares;
        }
        return v;
      });

      const bars = stocks
        .filter((a) => a.shares > 0)
        .map((a) => ({ symbol: a.symbol, pct: a.percentage }))
        .sort((x, y) => y.pct - x.pct);

      return { ...m, total, invested, pnl, pnlPct, stockCount, cashPct, trend, bars };
    });
  }, [models, priceMap, history]);

  // Debounced stock search
  useEffect(() => {
    if (stockQuery.length < 1) {
      setStockResults([]);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/psx?action=search&q=${encodeURIComponent(stockQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          const existing = new Set(allocations.map((a) => a.symbol));
          setStockResults(
            data
              .filter((s: SearchStock) => !existing.has(s.symbol))
              .slice(0, 8)
          );
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [stockQuery, allocations]);

  const totalPct = allocations.reduce((sum, a) => sum + a.percentage, 0);
  const cashAmount = parseFloat(formCash) || 0;

  const handleAddStock = (stock: SearchStock) => {
    if (allocations.some((a) => a.symbol === stock.symbol)) return;

    const defaultPct = Math.min(
      10,
      100 -
        totalPct +
        (allocations.find((a) => a.symbol === "CASH")?.percentage || 0)
    );

    setAllocations((prev) => {
      const updated = prev.map((a) =>
        a.symbol === "CASH"
          ? { ...a, percentage: Math.max(0, a.percentage - defaultPct) }
          : a
      );
      const newAlloc: typeof updated[0] = {
        symbol: stock.symbol,
        companyName: stock.company,
        percentage: defaultPct,
      };
      // In shares mode, compute initial shares from the default percentage
      if (allocMode === "shares" && cashAmount > 0 && stock.current > 0) {
        const allocAmount = (defaultPct / 100) * cashAmount;
        newAlloc.inputShares = Math.floor(allocAmount / stock.current);
      }
      return [...updated, newAlloc];
    });

    setMarketPrices((prev) => ({ ...prev, [stock.symbol]: stock.current }));
    setCustomPriceInputs((prev) => ({ ...prev, [stock.symbol]: stock.current > 0 ? String(stock.current) : "" }));
    setStockQuery("");
    setStockResults([]);
  };

  const handleRemoveAlloc = (symbol: string) => {
    if (symbol === "CASH") return;
    const removing = allocations.find((a) => a.symbol === symbol);
    if (!removing) return;

    setAllocations((prev) =>
      prev
        .filter((a) => a.symbol !== symbol)
        .map((a) =>
          a.symbol === "CASH"
            ? { ...a, percentage: a.percentage + removing.percentage }
            : a
        )
    );
  };

  const handlePctChange = (symbol: string, newPct: number) => {
    const oldAlloc = allocations.find((a) => a.symbol === symbol);
    if (!oldAlloc) return;
    const diff = newPct - oldAlloc.percentage;

    setAllocations((prev) =>
      prev.map((a) => {
        if (a.symbol === symbol) return { ...a, percentage: newPct };
        if (a.symbol === "CASH" && symbol !== "CASH")
          return { ...a, percentage: Math.max(0, a.percentage - diff) };
        return a;
      })
    );
  };

  // In shares mode: update shares count and recalc only the changed stock's % + CASH
  const handleSharesChange = (symbol: string, newShares: number) => {
    setAllocations((prev) => {
      if (cashAmount <= 0) {
        return prev.map((a) =>
          a.symbol === symbol ? { ...a, inputShares: newShares } : a
        );
      }

      // Calculate new percentage for the changed stock
      const alloc = prev.find((a) => a.symbol === symbol);
      const price = alloc?.customPrice || marketPrices[symbol] || 0;
      const newPct = price > 0 ? Math.round((newShares * price / cashAmount) * 1000) / 10 : 0;

      // Adjust only this stock and CASH
      const oldPct = alloc?.percentage ?? 0;
      const diff = newPct - oldPct;

      return prev.map((a) => {
        if (a.symbol === symbol) return { ...a, inputShares: newShares, percentage: newPct };
        if (a.symbol === "CASH") return { ...a, percentage: Math.max(0, Math.round((a.percentage - diff) * 10) / 10) };
        return a;
      });
    });
  };

  // Recalc all percentages when cash amount changes in shares mode
  useEffect(() => {
    if (allocMode !== "shares" || cashAmount <= 0) return;
    setAllocations((prev) => {
      let usedPct = 0;
      const recalced = prev.map((a) => {
        if (a.symbol === "CASH") return a;
        const price = a.customPrice || marketPrices[a.symbol] || 0;
        const shares = a.inputShares ?? 0;
        const cost = shares * price;
        const pct = Math.round((cost / cashAmount) * 1000) / 10;
        usedPct += pct;
        return { ...a, percentage: pct };
      });
      return recalced.map((a) =>
        a.symbol === "CASH" ? { ...a, percentage: Math.max(0, Math.round((100 - usedPct) * 10) / 10) } : a
      );
    });
  // Only recalc when cash amount changes — individual stock changes handled by handleSharesChange
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashAmount, allocMode]);

  const openCreateEditor = () => {
    setFormName("");
    setFormDescription("");
    setFormCash("");
    setAllocations([
      { symbol: "CASH", companyName: "Cash Reserve", percentage: 100 },
    ]);
    setStockQuery("");
    setStockResults([]);
    setMarketPrices({});
    setCustomPriceInputs({});
    setAllocMode("percent");
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (
      !formName.trim() ||
      Math.abs(totalPct - 100) > 1 ||
      cashAmount <= 0
    )
      return;
    setSaving(true);

    try {
      const res = await fetch("/api/model-portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription,
          cashBalance: cashAmount,
          allocations: allocations.map((a) => ({
            symbol: a.symbol,
            companyName: a.companyName,
            percentage: a.percentage,
            customPrice: a.customPrice,
            ...(allocMode === "shares" && a.inputShares != null ? { exactShares: a.inputShares } : {}),
          })),
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setShowEditor(false);
        router.push(`/models/${created.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this model portfolio?")) return;
    const res = await fetch(`/api/model-portfolios/${id}`, {
      method: "DELETE",
    });
    if (res.ok) fetchData();
  };

  if (initialLoading) return <PageSkeleton />;

  const validForm =
    !!formName.trim() && Math.abs(totalPct - 100) <= 1 && cashAmount > 0;

  return (
    <>
      {/* Page header */}
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            Model portfolios
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">Models</h1>
        </div>
        <button
          onClick={openCreateEditor}
          className="flex h-[38px] items-center gap-2 rounded-[10px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105"
        >
          <Plus className="h-[15px] w-[15px]" />
          New Model
        </button>
      </div>

      {/* Model grid */}
      {!loading && models.length === 0 && !showEditor ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-card py-16 text-center shadow-card">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-line bg-canvas">
            <Layers className="h-6 w-6 text-ink-3" />
          </div>
          <h3 className="mb-2 text-base font-semibold">No model portfolios yet</h3>
          <p className="mx-auto mb-6 max-w-sm text-sm text-ink-3">
            Create a model portfolio with starting cash. Pick stocks, set
            percentages, and shares are auto-purchased at market price.
          </p>
          <button
            onClick={openCreateEditor}
            className="flex h-[38px] items-center gap-2 rounded-[10px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105"
          >
            <Plus className="h-[15px] w-[15px]" />
            Create Your First Model
          </button>
        </div>
      ) : (
        <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {modelMetrics.map((m) => {
            const mUp = m.pnl >= 0;
            return (
              <Link
                key={m.id}
                href={`/models/${m.id}`}
                className="group relative rounded-2xl border border-line bg-card p-[22px] shadow-card transition hover:-translate-y-[3px] hover:border-brand hover:shadow-[0_12px_34px_rgba(13,18,28,.10)]"
              >
                <button
                  onClick={(e) => handleDelete(e, m.id)}
                  title="Delete"
                  className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-ink-3 opacity-0 transition hover:bg-ink/[.04] hover:text-loss-strong group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-start justify-between gap-2.5 pr-7">
                  <div>
                    <div className="text-[15.5px] font-bold tracking-[-.02em]">{m.name}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      {m.stockCount} stocks · {m.cashPct.toFixed(0)}% cash
                    </div>
                  </div>
                  <span
                    className="num rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                    style={{
                      color: mUp ? "var(--color-gain)" : "var(--color-loss-strong)",
                      background: mUp ? "var(--color-gain-50)" : "var(--color-loss-50)",
                    }}
                  >
                    {mUp ? "+" : ""}
                    {m.pnlPct.toFixed(2)}%
                  </span>
                </div>
                <div className="num mb-0.5 mt-2.5 text-[27px] font-bold tracking-[-.03em]">
                  Rs {formatPKR(m.total, { decimals: 0 })}
                </div>
                <div className="text-[12px] text-ink-2">
                  {mUp ? "Up" : "Down"} Rs {formatPKR(Math.abs(m.pnl), { decimals: 0 })}
                </div>
                <div className="-mx-1 mt-3 h-11">
                  {m.trend.length >= 2 ? (
                    <Sparkline
                      data={m.trend}
                      width={240}
                      height={44}
                      strokeWidth={1.8}
                      color={mUp ? "var(--color-gain)" : "var(--color-loss-strong)"}
                      className="h-full w-full"
                    />
                  ) : null}
                </div>
                <div className="mt-3 flex h-[5px] overflow-hidden rounded bg-canvas">
                  {m.bars.map((b, i) => (
                    <span
                      key={b.symbol}
                      style={{
                        width: `${b.pct}%`,
                        background: ALLOC_COLORS[i % ALLOC_COLORS.length],
                      }}
                    />
                  ))}
                  {m.cashPct > 0 && (
                    <span style={{ width: `${m.cashPct}%`, background: CASH_COLOR }} />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════ */}
      {/* Create Model Editor                */}
      {/* ═══════════════════════════════════ */}
      {showEditor && (
        <div className="mt-[18px] rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[18px] font-bold tracking-[-.02em]">
              Create Model Portfolio
            </h2>
            <button
              onClick={() => setShowEditor(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-ink/[.04] hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Name, Description, Cash */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                  Model Name
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Blue Chip Mix"
                  className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-[13px] outline-none focus:border-brand"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                  Description (optional)
                </label>
                <input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Strategy description"
                  className="h-10 w-full rounded-[10px] border border-line bg-card px-3 text-[13px] outline-none focus:border-brand"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                  Starting Cash (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formCash}
                  onChange={(e) => setFormCash(e.target.value)}
                  placeholder="e.g. 100000"
                  className="num h-10 w-full rounded-[10px] border border-line bg-card px-3 text-[13px] outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Stock Search */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Add Stocks
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <input
                  value={stockQuery}
                  onChange={(e) => setStockQuery(e.target.value)}
                  placeholder="Search stocks to add…"
                  className="h-10 w-full rounded-[10px] border border-line bg-card pl-9 pr-3 text-[13px] outline-none focus:border-brand"
                />
              </div>
              {stockResults.length > 0 && (
                <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                  {stockResults.map((stock) => (
                    <button
                      key={stock.symbol}
                      className="group flex items-center justify-between rounded-[10px] border border-line bg-card px-3 py-2 text-left transition hover:border-brand hover:bg-ink/[.03]"
                      onClick={() => handleAddStock(stock)}
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-semibold group-hover:text-brand">
                          {stock.symbol}
                        </span>
                        <p className="truncate text-[11px] text-ink-3">
                          {stock.company}
                        </p>
                      </div>
                      <div className="ml-2 shrink-0 text-right">
                        <p className="num text-xs font-semibold">
                          Rs {formatPKR(stock.current)}
                        </p>
                        <Plus className="ml-auto h-3.5 w-3.5 text-ink-3 group-hover:text-brand" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchLoading && stockQuery.length > 0 && (
                <p className="text-xs text-ink-3">Searching…</p>
              )}
            </div>

            {/* Allocations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                    Allocations
                  </label>
                  <div className="flex items-center rounded-[10px] bg-canvas p-0.5">
                    <button
                      type="button"
                      onClick={() => setAllocMode("percent")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                        allocMode === "percent"
                          ? "bg-card text-ink shadow-card"
                          : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      <Percent className="h-3 w-3" />
                      Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAllocMode("shares");
                        // Initialize inputShares from current percentage estimates
                        if (cashAmount > 0) {
                          setAllocations((prev) =>
                            prev.map((a) => {
                              if (a.symbol === "CASH") return a;
                              const price = a.customPrice || marketPrices[a.symbol] || 0;
                              const allocAmount = (a.percentage / 100) * cashAmount;
                              const estShares = price > 0 ? Math.floor(allocAmount / price) : 0;
                              return { ...a, inputShares: estShares };
                            })
                          );
                        }
                      }}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                        allocMode === "shares"
                          ? "bg-card text-ink shadow-card"
                          : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      <Hash className="h-3 w-3" />
                      Shares
                    </button>
                  </div>
                </div>
                <span
                  className="num text-xs font-semibold"
                  style={{
                    color:
                      Math.abs(totalPct - 100) < 1
                        ? "var(--color-gain)"
                        : undefined,
                  }}
                >
                  {totalPct.toFixed(1)}% / 100%
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex h-2 overflow-hidden rounded-full bg-canvas">
                {allocations
                  .filter((a) => a.percentage > 0)
                  .map((a, i) => (
                    <div
                      key={a.symbol}
                      className="h-full transition-all"
                      style={{
                        width: `${a.percentage}%`,
                        background:
                          a.symbol === "CASH"
                            ? CASH_COLOR
                            : ALLOC_COLORS[i % ALLOC_COLORS.length],
                      }}
                      title={`${a.symbol}: ${a.percentage}%`}
                    />
                  ))}
              </div>

              <div className="space-y-2">
                {allocations.map((alloc) => {
                  const mktPrice = marketPrices[alloc.symbol] || 0;
                  const usePrice = alloc.customPrice || mktPrice;
                  const allocAmount = (alloc.percentage / 100) * cashAmount;
                  const estShares =
                    alloc.symbol !== "CASH" && usePrice > 0
                      ? Math.floor(allocAmount / usePrice)
                      : 0;
                  const estCost = estShares * usePrice;

                  return (
                    <div
                      key={alloc.symbol}
                      className="rounded-[10px] border border-line bg-card p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {alloc.symbol === "CASH"
                              ? "Cash Reserve"
                              : alloc.symbol}
                          </p>
                          {alloc.symbol !== "CASH" && (
                            <p className="truncate text-[11px] text-ink-3">
                              {alloc.companyName}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {allocMode === "percent" || alloc.symbol === "CASH" ? (
                            <>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={alloc.percentage}
                                onChange={(e) =>
                                  handlePctChange(
                                    alloc.symbol,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="num h-8 w-20 rounded-[10px] border border-line bg-card text-center text-sm outline-none focus:border-brand disabled:opacity-60"
                                disabled={allocMode === "shares" && alloc.symbol === "CASH"}
                              />
                              <span className="text-xs font-semibold text-ink-3">
                                %
                              </span>
                            </>
                          ) : (
                            <>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={alloc.inputShares ?? 0}
                                onChange={(e) =>
                                  handleSharesChange(
                                    alloc.symbol,
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="num h-8 w-20 rounded-[10px] border border-line bg-card text-center text-sm outline-none focus:border-brand"
                              />
                              <span className="text-xs font-semibold text-ink-3">
                                shares
                              </span>
                              <span className="num text-[11px] text-ink-3">
                                ({alloc.percentage.toFixed(1)}%)
                              </span>
                            </>
                          )}
                          {alloc.symbol !== "CASH" && (
                            <button
                              onClick={() => handleRemoveAlloc(alloc.symbol)}
                              className="grid h-7 w-7 place-items-center rounded-lg text-ink-3 hover:bg-ink/[.04] hover:text-ink"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Price & shares row for stocks */}
                      {alloc.symbol !== "CASH" && (
                        <div className="mt-2 flex items-center gap-3 pl-0">
                          <div className="flex items-center gap-1.5">
                            <label className="whitespace-nowrap text-[11px] text-ink-3">
                              Buy @
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={customPriceInputs[alloc.symbol] ?? (mktPrice > 0 ? String(mktPrice) : "")}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setCustomPriceInputs((prev) => ({ ...prev, [alloc.symbol]: raw }));
                                const val = raw === "" ? undefined : parseFloat(raw);
                                setAllocations((prev) => {
                                  const updated = prev.map((a) =>
                                    a.symbol === alloc.symbol ? { ...a, customPrice: val } : a
                                  );
                                  // Recalc % in shares mode
                                  if (allocMode === "shares" && cashAmount > 0) {
                                    const thisAlloc = updated.find((a) => a.symbol === alloc.symbol);
                                    const shares = thisAlloc?.inputShares ?? 0;
                                    const effectivePrice = (val != null && val > 0) ? val : mktPrice;
                                    const newPct = effectivePrice > 0 ? Math.round((shares * effectivePrice / cashAmount) * 1000) / 10 : 0;
                                    const oldPct = thisAlloc?.percentage ?? 0;
                                    const diff = newPct - oldPct;
                                    return updated.map((a) => {
                                      if (a.symbol === alloc.symbol) return { ...a, percentage: newPct };
                                      if (a.symbol === "CASH") return { ...a, percentage: Math.max(0, Math.round((a.percentage - diff) * 10) / 10) };
                                      return a;
                                    });
                                  }
                                  return updated;
                                });
                              }}
                              className="num h-7 w-24 rounded-[10px] border border-line bg-card text-center text-xs outline-none focus:border-brand"
                            />
                          </div>
                          {mktPrice > 0 && (
                            <span className="text-[10px] text-ink-3">
                              Mkt: {formatPKR(mktPrice)}
                            </span>
                          )}
                          {allocMode === "shares" ? (
                            usePrice > 0 && (alloc.inputShares ?? 0) > 0 && (
                              <span className="ml-auto text-[11px] text-ink-3">
                                = Rs{" "}
                                <span className="font-semibold text-ink">
                                  {formatPKR((alloc.inputShares ?? 0) * usePrice, { decimals: 0 })}
                                </span>
                              </span>
                            )
                          ) : (
                            usePrice > 0 && cashAmount > 0 && (
                              <span className="ml-auto text-[11px] text-ink-3">
                                <span className="font-semibold text-ink">
                                  {estShares} shares
                                </span>{" "}
                                = Rs {formatPKR(estCost, { decimals: 0 })}
                              </span>
                            )
                          )}
                        </div>
                      )}

                      {/* Cash info */}
                      {alloc.symbol === "CASH" && cashAmount > 0 && (
                        <p className="mt-1.5 text-[11px] text-ink-3">
                          Rs {formatPKR(allocAmount, { decimals: 0 })} reserved
                          {allocMode === "shares" && (
                            <span className="ml-1">({alloc.percentage.toFixed(1)}%)</span>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditor(false)}
                className="h-[38px] rounded-[10px] border border-line bg-card px-4 text-[13px] font-medium text-ink-2 hover:bg-ink/[.04]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !validForm}
                className="flex h-[38px] flex-1 items-center justify-center rounded-[10px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105 disabled:opacity-50"
              >
                {saving ? "Creating…" : allocMode === "shares" ? "Create & Buy Shares" : "Create & Buy Stocks"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
