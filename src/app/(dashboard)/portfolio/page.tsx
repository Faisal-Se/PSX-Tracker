"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Settings,
  Trash2,
  Pencil,
  ListFilter,
  Briefcase,
  PackageOpen,
} from "lucide-react";
import { TradeDialog } from "@/components/TradeDialog";
import { StockSearch } from "@/components/StockSearch";
import { formatPKR } from "@/lib/market-status";
import { PageSkeleton } from "@/components/ui/skeleton";
import { NavProgressionChart } from "@/components/NavProgressionChart";
import { BenchmarkChart } from "@/components/BenchmarkChart";
import {
  ResponsiveContainer,
  Tooltip,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from "recharts";

interface Holding {
  id: string;
  symbol: string;
  companyName: string;
  quantity: number;
  avgPrice: number;
}

interface Portfolio {
  id: string;
  name: string;
  type: string;
  cashBalance: number;
  holdings: Holding[];
  _count: { transactions: number };
}

interface MarketStock {
  symbol: string;
  company: string;
  current: number;
  change: number;
  changePercent: number;
}

interface HistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type SortKey = "value" | "pnl" | "symbol";

/* Avatar tint palette (per ticker) — multi-series, never used for P&L. */
const TINTS = [
  "#2563EB",
  "#7C3AED",
  "#0D9488",
  "#DB2777",
  "#CA8A04",
  "#0891B2",
  "#16A34A",
  "#4F46E5",
];
function tint(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/* Allocation/donut palette (NOT P&L). */
const ALLOC_COLORS = ["#7C3AED", "#0D9488", "#2563EB", "#0891B2", "#CA8A04", "#DB2777"];
const CASH_COLOR = "#CBD5E1";

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [marketData, setMarketData] = useState<Map<string, MarketStock>>(
    new Map()
  );
  const [initialLoading, setInitialLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Personal");
  const [newCash, setNewCash] = useState("1000000");
  const [activeTab, setActiveTab] = useState<string>("");
  const [tradeStock, setTradeStock] = useState<{
    symbol: string;
    company: string;
    price: number;
    portfolioId?: string;
  } | null>(null);

  // Edit portfolio state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [addCashAmount, setAddCashAmount] = useState("");
  const [removeCashAmount, setRemoveCashAmount] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Holdings table sorting + price history (for sparklines)
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});

  const fetchData = useCallback(async () => {
    const [portfolioRes, marketRes] = await Promise.all([
      fetch("/api/portfolios"),
      fetch("/api/psx"),
    ]);

    if (portfolioRes.ok) {
      const data = await portfolioRes.json();
      setPortfolios(data);
      if (!activeTab && data.length > 0) {
        setActiveTab(data[0].id);
      }
    }
    if (marketRes.ok) {
      const data = await marketRes.json();
      const map = new Map<string, MarketStock>();
      if (Array.isArray(data)) {
        data.forEach((s: MarketStock) => map.set(s.symbol, s));
      }
      setMarketData(map);
    }
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreatePortfolio = async () => {
    const res = await fetch("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        type: newType,
        cashBalance: parseFloat(newCash),
      }),
    });
    if (res.ok) {
      const newPortfolio = await res.json();
      setShowCreate(false);
      setNewName("");
      setNewCash("1000000");
      setActiveTab(newPortfolio.id);
      fetchData();
    }
  };

  const activePortfolio = portfolios.find((p) => p.id === activeTab);

  // Symbols held in the active portfolio (capped) for sparkline history
  const activeSymbols = useMemo(() => {
    if (!activePortfolio) return [] as string[];
    return Array.from(new Set(activePortfolio.holdings.map((h) => h.symbol))).slice(0, 12);
  }, [activePortfolio]);

  // Holdings shaped for the NAV/benchmark charts.
  const chartHoldings = useMemo(
    () =>
      (activePortfolio?.holdings || []).map((h) => ({
        symbol: h.symbol,
        shares: h.quantity,
        avgPrice: h.avgPrice,
      })),
    [activePortfolio]
  );

  // Fetch per-symbol price history for the active portfolio's holdings
  useEffect(() => {
    if (activeSymbols.length === 0) return;
    let cancelled = false;
    (async () => {
      const missing = activeSymbols.filter((s) => !history[s]);
      if (missing.length === 0) return;
      const results = await Promise.all(
        missing.map(async (sym) => {
          try {
            const res = await fetch(
              `/api/psx/history?symbol=${encodeURIComponent(sym)}`
            );
            if (!res.ok) return [sym, [] as HistoryPoint[]] as const;
            const data = (await res.json()) as HistoryPoint[];
            return [sym, Array.isArray(data) ? data : []] as const;
          } catch {
            return [sym, [] as HistoryPoint[]] as const;
          }
        })
      );
      if (cancelled) return;
      setHistory((prev) => {
        const next = { ...prev };
        for (const [sym, data] of results) next[sym] = data;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbols]);

  const openEditDialog = () => {
    if (!activePortfolio) return;
    setEditName(activePortfolio.name);
    setEditType(activePortfolio.type);
    setAddCashAmount("");
    setRemoveCashAmount("");
    setShowEdit(true);
  };

  const handleEditPortfolio = async () => {
    if (!activePortfolio) return;
    setEditLoading(true);

    const payload: Record<string, unknown> = {};
    if (editName && editName !== activePortfolio.name) payload.name = editName;
    if (editType && editType !== activePortfolio.type) payload.type = editType;
    if (addCashAmount && parseFloat(addCashAmount) > 0)
      payload.addCash = parseFloat(addCashAmount);
    if (removeCashAmount && parseFloat(removeCashAmount) > 0)
      payload.removeCash = parseFloat(removeCashAmount);

    if (Object.keys(payload).length > 0) {
      await fetch(`/api/portfolios/${activePortfolio.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setEditLoading(false);
    setShowEdit(false);
    fetchData();
  };

  const handleDeletePortfolio = async () => {
    if (!activePortfolio) return;
    if (
      !confirm(
        `Are you sure you want to delete "${activePortfolio.name}"? This action cannot be undone.`
      )
    )
      return;

    setEditLoading(true);
    const res = await fetch(`/api/portfolios/${activePortfolio.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setShowEdit(false);
      setEditLoading(false);
      const remaining = portfolios.filter((p) => p.id !== activePortfolio.id);
      setActiveTab(remaining.length > 0 ? remaining[0].id : "");
      fetchData();
    } else {
      setEditLoading(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  // ---- Derived data for the active portfolio ----
  const totalInvested = activePortfolio
    ? activePortfolio.holdings.reduce((s, h) => s + h.avgPrice * h.quantity, 0)
    : 0;
  const totalCurrent = activePortfolio
    ? activePortfolio.holdings.reduce((s, h) => {
        const price = marketData.get(h.symbol)?.current || h.avgPrice;
        return s + price * h.quantity;
      }, 0)
    : 0;
  const pnl = totalCurrent - totalInvested;
  const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
  const totalValue = (activePortfolio?.cashBalance || 0) + totalCurrent;
  const up = pnl >= 0;

  // Sortable holding rows for the active portfolio
  const holdingRows = useMemo(() => {
    if (!activePortfolio) return [];
    const rows = activePortfolio.holdings.map((h) => {
      const currentPrice = marketData.get(h.symbol)?.current || h.avgPrice;
      const value = currentPrice * h.quantity;
      const hPnl = (currentPrice - h.avgPrice) * h.quantity;
      const hPnlPercent =
        h.avgPrice > 0 ? ((currentPrice - h.avgPrice) / h.avgPrice) * 100 : 0;
      const trend = (history[h.symbol] || [])
        .map((p) => p.close)
        .filter((n) => n > 0)
        .slice(-20);
      return { ...h, currentPrice, value, pnl: hPnl, pnlPercent: hPnlPercent, trend };
    });
    rows.sort((a, b) => {
      if (sortKey === "symbol") {
        return sortDir === "desc"
          ? b.symbol.localeCompare(a.symbol)
          : a.symbol.localeCompare(b.symbol);
      }
      const av = sortKey === "value" ? a.value : a.pnl;
      const bv = sortKey === "value" ? b.value : b.pnl;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePortfolio, marketData, history, sortKey, sortDir]);

  // Allocation donut (holdings + cash)
  const allocationData = useMemo(() => {
    if (!activePortfolio) return [];
    const slices = activePortfolio.holdings
      .map((h) => {
        const cp = marketData.get(h.symbol)?.current || h.avgPrice;
        return { name: h.symbol, value: cp * h.quantity };
      })
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
    if (activePortfolio.cashBalance > 0)
      slices.push({ name: "Cash", value: activePortfolio.cashBalance });
    const total = slices.reduce((s, x) => s + x.value, 0) || 1;
    return slices.map((s) => ({ ...s, pct: (s.value / total) * 100 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePortfolio, marketData]);

  const holdingCount = activePortfolio?.holdings.length ?? 0;

  if (initialLoading) return <PageSkeleton />;

  return (
    <>
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            Personal portfolios
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">Portfolio</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {activePortfolio && (
            <button
              onClick={openEditDialog}
              className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04]"
            >
              <Settings className="h-[15px] w-[15px]" />
              Settings
            </button>
          )}
        </div>
      </div>

      {portfolios.length === 0 ? (
        <section className="rounded-2xl border border-line bg-card p-[22px] py-16 text-center shadow-card">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
            <Briefcase className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-base font-semibold">No portfolios yet</h3>
          <p className="mx-auto mb-6 max-w-sm text-sm text-ink-3">
            Create your first portfolio to start tracking investments, managing
            cash, and monitoring your returns.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105"
          >
            <Plus className="h-[15px] w-[15px]" />
            Create Your First Portfolio
          </button>
        </section>
      ) : (
        <>
          {/* Portfolio selector tabs (pill buttons) */}
          <div className="mb-[18px] flex flex-wrap gap-2">
            {portfolios.map((p) => {
              const active = p.id === activeTab;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveTab(p.id)}
                  className={`flex h-[38px] items-center gap-2 rounded-[10px] px-4 text-[13px] font-semibold ${
                    active
                      ? "border border-brand bg-brand/10 text-brand"
                      : "border border-line bg-card text-ink-2 shadow-card hover:bg-ink/[.04]"
                  }`}
                >
                  {p.name}
                  <span
                    className={`text-[10.5px] font-medium ${
                      active ? "opacity-80" : "text-ink-3"
                    }`}
                  >
                    {p.type}
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => setShowCreate(true)}
              aria-label="New portfolio"
              className="grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-dashed border-line text-ink-2 hover:bg-ink/[.04]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {activePortfolio && (
            <>
              {/* Total Value + Allocation */}
              <div className="mb-[18px] grid gap-[18px] lg:grid-cols-[1.5fr_1fr]">
                {/* Total Value hero */}
                <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
                  <div className="mb-2 text-[13px] font-medium text-ink-2">
                    Total Value
                  </div>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <div className="num whitespace-nowrap text-[40px] font-bold leading-none tracking-[-.035em]">
                      Rs {formatPKR(totalValue, { decimals: 0 })}
                    </div>
                    <span
                      className="num rounded-lg px-2.5 py-1 text-[13px] font-semibold"
                      style={{
                        color: up ? "var(--color-gain)" : "var(--color-loss-strong)",
                        background: up ? "var(--color-gain-50)" : "var(--color-loss-50)",
                      }}
                    >
                      {up ? "+" : "−"}
                      {Math.abs(pnlPercent).toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-2.5 text-[13px] text-ink-3">
                    {up ? "Up" : "Down"} Rs {formatPKR(Math.abs(pnl), { decimals: 0 })}{" "}
                    all time
                  </div>

                  <div className="mt-[22px] flex flex-wrap gap-[22px] border-t border-line pt-5">
                    <div className="min-w-[90px] flex-1">
                      <div className="mb-1.5 text-[12px] text-ink-2">Cash</div>
                      <div className="num text-[18px] font-bold">
                        Rs {formatPKR(activePortfolio.cashBalance, { decimals: 0 })}
                      </div>
                    </div>
                    <div className="min-w-[90px] flex-1">
                      <div className="mb-1.5 text-[12px] text-ink-2">Invested</div>
                      <div className="num text-[18px] font-bold">
                        Rs {formatPKR(totalInvested, { decimals: 0 })}
                      </div>
                    </div>
                    <div className="min-w-[90px] flex-1">
                      <div className="mb-1.5 text-[12px] text-ink-2">
                        Market Value
                      </div>
                      <div className="num text-[18px] font-bold">
                        Rs {formatPKR(totalCurrent, { decimals: 0 })}
                      </div>
                    </div>
                    <div className="min-w-[90px] flex-1">
                      <div className="mb-1.5 text-[12px] text-ink-2">Total P&L</div>
                      <div
                        className="num text-[18px] font-bold"
                        style={{
                          color: up
                            ? "var(--color-gain)"
                            : "var(--color-loss-strong)",
                        }}
                      >
                        {up ? "+" : "−"}Rs {formatPKR(Math.abs(pnl), { decimals: 0 })}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Allocation donut */}
                <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
                  <div className="text-[14px] font-bold">Allocation</div>
                  <div className="mb-3.5 mt-0.5 text-[12px] text-ink-3">
                    By market value
                  </div>
                  {allocationData.length === 0 ? (
                    <div className="flex h-[132px] items-center justify-center">
                      <p className="text-xs text-ink-3">No allocation yet</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-[18px]">
                      <div className="relative h-[132px] w-[132px] shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPie>
                            <Pie
                              data={allocationData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius="58%"
                              outerRadius="100%"
                              paddingAngle={1.5}
                              stroke="none"
                              isAnimationActive
                              animationDuration={900}
                            >
                              {allocationData.map((e, i) => (
                                <Cell
                                  key={e.name}
                                  fill={
                                    e.name === "Cash"
                                      ? CASH_COLOR
                                      : ALLOC_COLORS[i % ALLOC_COLORS.length]
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: "var(--color-card)",
                                border: "1px solid var(--color-line)",
                                borderRadius: 12,
                                fontSize: 12,
                                color: "var(--color-ink)",
                                boxShadow: "var(--shadow-pop)",
                              }}
                              formatter={(v, n) => [
                                `Rs ${formatPKR(Number(v), { decimals: 0 })}`,
                                String(n),
                              ]}
                            />
                          </RechartsPie>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                          <div>
                            <div className="text-[11px] text-ink-3">Holdings</div>
                            <div className="num text-[18px] font-bold">
                              {holdingCount}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-2">
                        {allocationData.slice(0, 6).map((e, i) => (
                          <div key={e.name} className="flex items-center gap-2">
                            <span
                              className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
                              style={{
                                background:
                                  e.name === "Cash"
                                    ? CASH_COLOR
                                    : ALLOC_COLORS[i % ALLOC_COLORS.length],
                              }}
                            />
                            <span className="flex-1 text-[12px] font-medium">
                              {e.name}
                            </span>
                            <span className="num text-[12px] font-semibold text-ink-2">
                              {e.pct.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* NAV progression + benchmark */}
              <div className="mb-[18px] grid gap-[18px] lg:grid-cols-2">
                <NavProgressionChart
                  holdings={chartHoldings}
                  cash={activePortfolio.cashBalance}
                  history={history}
                />
                <BenchmarkChart
                  holdings={chartHoldings}
                  cash={activePortfolio.cashBalance}
                  history={history}
                />
              </div>

              {/* Holdings table */}
              <section className="rounded-2xl border border-line bg-card pb-2 shadow-card">
                <div className="flex items-center justify-between px-[22px] pb-3 pt-[22px]">
                  <h2 className="text-[16px] font-bold">Holdings</h2>
                  <button
                    onClick={() =>
                      activePortfolio.holdings[0]
                        ? setTradeStock({
                            symbol: activePortfolio.holdings[0].symbol,
                            company: activePortfolio.holdings[0].companyName,
                            price:
                              marketData.get(activePortfolio.holdings[0].symbol)
                                ?.current || activePortfolio.holdings[0].avgPrice,
                            portfolioId: activePortfolio.id,
                          })
                        : document
                            .getElementById("portfolio-quick-trade")
                            ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="flex h-10 items-center gap-2 rounded-[11px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105"
                  >
                    <ListFilter className="h-[15px] w-[15px]" />
                    Quick Trade
                  </button>
                </div>

                {/* Quick Trade search (anchored) */}
                <div id="portfolio-quick-trade" className="px-[22px] pb-3">
                  <StockSearch
                    onSelect={(stock) =>
                      setTradeStock({
                        symbol: stock.symbol,
                        company: stock.company,
                        price: stock.current,
                        portfolioId: activePortfolio.id,
                      })
                    }
                    placeholder="Search a stock to buy or sell…"
                  />
                </div>

                {activePortfolio.holdings.length === 0 ? (
                  <div className="px-[22px] py-12 text-center">
                    <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
                      <PackageOpen className="h-6 w-6" />
                    </div>
                    <p className="mb-1 text-sm font-medium text-ink-3">
                      No holdings yet
                    </p>
                    <p className="mx-auto max-w-xs text-xs text-ink-3">
                      Use the Quick Trade search above to buy your first stock in
                      this portfolio.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Column headers */}
                    <div className="grid grid-cols-[2.2fr_.9fr_1fr_1fr_1.1fr_1fr_84px] gap-2 border-b border-line px-[22px] pb-2.5 text-[11px] font-semibold tracking-[.03em] text-ink-3">
                      <button
                        onClick={() => toggleSort("symbol")}
                        className="text-left hover:text-ink"
                      >
                        STOCK
                      </button>
                      <span className="text-right">QTY</span>
                      <span className="text-right">AVG</span>
                      <span className="text-right">CURRENT</span>
                      <button
                        onClick={() => toggleSort("value")}
                        className="text-right hover:text-ink"
                      >
                        VALUE
                      </button>
                      <button
                        onClick={() => toggleSort("pnl")}
                        className="text-right hover:text-ink"
                      >
                        P&L
                      </button>
                      <span />
                    </div>

                    {/* Rows */}
                    {holdingRows.map((h) => {
                      const hUp = h.pnl >= 0;
                      const c = tint(h.symbol);
                      return (
                        <div
                          key={h.id}
                          className="grid grid-cols-[2.2fr_.9fr_1fr_1fr_1.1fr_1fr_84px] items-center gap-2 border-b border-line-soft px-[22px] py-[11px] hover:bg-ink/[.03]"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[12px] font-bold"
                              style={{ background: `${c}22`, color: c }}
                            >
                              {h.symbol.slice(0, 2)}
                            </span>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold">
                                {h.symbol}
                              </div>
                              <div className="truncate text-[11px] text-ink-3">
                                {h.companyName}
                              </div>
                            </div>
                          </div>
                          <span className="num text-right text-[12.5px]">
                            {h.quantity.toLocaleString()}
                          </span>
                          <span className="num text-right text-[12.5px] text-ink-2">
                            {formatPKR(h.avgPrice)}
                          </span>
                          <span className="num text-right text-[12.5px] font-semibold">
                            {formatPKR(h.currentPrice)}
                          </span>
                          <span className="num text-right text-[12.5px] font-semibold">
                            Rs {formatPKR(h.value, { decimals: 0 })}
                          </span>
                          <span
                            className="num text-right text-[12.5px] font-semibold"
                            style={{
                              color: hUp
                                ? "var(--color-gain)"
                                : "var(--color-loss-strong)",
                            }}
                          >
                            {hUp ? "+" : "−"}
                            {Math.abs(h.pnlPercent).toFixed(2)}%
                          </span>
                          <button
                            onClick={() =>
                              setTradeStock({
                                symbol: h.symbol,
                                company: h.companyName,
                                price: h.currentPrice,
                                portfolioId: activePortfolio.id,
                              })
                            }
                            className="h-[30px] justify-self-end rounded-lg border border-line px-3 text-[12px] font-semibold text-brand hover:bg-ink/[.04]"
                          >
                            Trade
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </section>
            </>
          )}
        </>
      )}

      {/* Create Portfolio Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl border-line bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Create New Portfolio
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Portfolio Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. My Trading Portfolio"
                className="rounded-[10px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Type</Label>
              <Select value={newType} onValueChange={(v) => v && setNewType(v)}>
                <SelectTrigger className="rounded-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Trading">Trading</SelectItem>
                  <SelectItem value="Family">Family</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Starting Cash (PKR)</Label>
              <Input
                type="number"
                value={newCash}
                onChange={(e) => setNewCash(e.target.value)}
                className="num rounded-[10px]"
              />
            </div>
            <button
              onClick={handleCreatePortfolio}
              disabled={!newName.trim()}
              className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-brand text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Create Portfolio
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Portfolio Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="rounded-2xl border-line bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Pencil className="h-4 w-4" />
              Edit Portfolio
            </DialogTitle>
          </DialogHeader>
          {activePortfolio && (
            <div className="space-y-5 pt-2">
              {/* Rename */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Portfolio Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Portfolio name"
                  className="rounded-[10px]"
                />
              </div>

              {/* Change Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <Select
                  value={editType}
                  onValueChange={(v) => v && setEditType(v)}
                >
                  <SelectTrigger className="rounded-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Personal">Personal</SelectItem>
                    <SelectItem value="Trading">Trading</SelectItem>
                    <SelectItem value="Family">Family</SelectItem>
                    <SelectItem value="Business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="bg-line" />

              {/* Cash Management */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Cash Management</p>
                <p className="text-xs text-ink-3">
                  Current balance:{" "}
                  <span className="num font-semibold text-ink">
                    Rs {formatPKR(activePortfolio.cashBalance, { decimals: 0 })}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-ink-3">Add Cash</Label>
                    <Input
                      type="number"
                      value={addCashAmount}
                      onChange={(e) => setAddCashAmount(e.target.value)}
                      placeholder="0"
                      className="num rounded-[10px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-ink-3">Remove Cash</Label>
                    <Input
                      type="number"
                      value={removeCashAmount}
                      onChange={(e) => setRemoveCashAmount(e.target.value)}
                      placeholder="0"
                      className="num rounded-[10px]"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleEditPortfolio}
                disabled={editLoading}
                className="flex h-[42px] w-full items-center justify-center rounded-[10px] bg-brand text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105 disabled:opacity-50"
              >
                {editLoading ? "Saving…" : "Save Changes"}
              </button>

              <Separator className="bg-line" />

              {/* Danger Zone */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-loss-strong">
                  Danger Zone
                </p>
                <button
                  onClick={handleDeletePortfolio}
                  disabled={editLoading}
                  className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-loss-50 text-[13px] font-semibold text-loss-strong hover:brightness-95 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Portfolio
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Trade Dialog */}
      {tradeStock && (
        <TradeDialog
          open={!!tradeStock}
          onOpenChange={(open) => !open && setTradeStock(null)}
          symbol={tradeStock.symbol}
          companyName={tradeStock.company}
          currentPrice={tradeStock.price}
          portfolios={portfolios.map((p) => ({
            id: p.id,
            name: p.name,
            cashBalance: p.cashBalance,
          }))}
          defaultPortfolioId={tradeStock.portfolioId || activeTab}
          onSuccess={fetchData}
        />
      )}
    </>
  );
}
