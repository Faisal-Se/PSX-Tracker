"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Wallet,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Settings,
  Trash2,
  PieChart as PieIcon,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  PackageOpen,
  CircleDollarSign,
  Pencil,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { TradeDialog } from "@/components/TradeDialog";
import { StockSearch } from "@/components/StockSearch";
import { formatPKR } from "@/lib/market-status";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/Sparkline";
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

// Indigo-family allocation palette (Linear-style, no rainbow)
const ALLOCATION_PALETTE = [
  "var(--primary)",
  "#6366f1",
  "#818cf8",
  "#a5b4fc",
  "#4f46e5",
  "#7c3aed",
  "#c7d2fe",
  "#3730a3",
];
const CASH_COLOR = "var(--muted-foreground)";

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
  const pnlColor = pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)";

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

  if (initialLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 lg:space-y-8 max-w-[1400px]">
      {/* Page Header */}
      <div className="flex items-end justify-between animate-in-up">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">
            Portfolio
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your investment portfolios and track performance
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New Portfolio
        </Button>
      </div>

      {portfolios.length === 0 ? (
        <Card className="border border-border bg-card rounded-xl animate-in-up-delay-1">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
              <Briefcase className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-2">No portfolios yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Create your first portfolio to start tracking investments,
              managing cash, and monitoring your returns.
            </p>
            <Button onClick={() => setShowCreate(true)} size="sm" className="h-8 text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Create Your First Portfolio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Portfolio selector tabs (flat, Linear-style) */}
          <div className="flex items-center gap-2 animate-in-up-delay-1">
            <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-card overflow-x-auto">
              {portfolios.map((p) => {
                const active = p.id === activeTab;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveTab(p.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
            {activePortfolio && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={openEditDialog}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>

          {activePortfolio && (
            <div className="space-y-6 lg:space-y-8">
              {/* Hero: total value + P&L summary */}
              <div className="rounded-xl border border-border bg-card overflow-hidden animate-in-up-delay-1">
                <div className="flex flex-col lg:flex-row">
                  <div className="p-5 lg:p-6 lg:w-[40%] lg:border-r border-border">
                    <div className="flex items-center gap-2 mb-2.5">
                      <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                        Total Value
                      </span>
                    </div>
                    <p className="text-3xl lg:text-4xl font-semibold font-tabular tracking-tight">
                      {formatPKR(totalValue, { decimals: 0 })}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold font-tabular"
                        style={{
                          color: pnlColor,
                          backgroundColor:
                            pnl >= 0
                              ? "var(--color-profit-bg)"
                              : "var(--color-loss-bg)",
                        }}
                      >
                        {pnl >= 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {pnlPercent >= 0 ? "+" : ""}
                        {pnlPercent.toFixed(2)}%
                      </span>
                      <span
                        className="text-xs font-medium font-tabular"
                        style={{ color: pnlColor }}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {formatPKR(pnl, { decimals: 0 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted font-medium text-foreground">
                        {activePortfolio.type}
                      </span>
                      <span>
                        {activePortfolio._count.transactions} transactions
                      </span>
                    </div>
                  </div>

                  {/* Allocation donut */}
                  <div className="flex-1 p-5 lg:p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <PieIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                        Allocation
                      </span>
                    </div>
                    {allocationData.length === 0 ? (
                      <div className="h-32 flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">
                          No allocation yet
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-5">
                        <div className="h-36 w-36 shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                              <Pie
                                data={allocationData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius="62%"
                                outerRadius="92%"
                                paddingAngle={1.5}
                                stroke="var(--card)"
                                strokeWidth={2}
                              >
                                {allocationData.map((entry, i) => (
                                  <Cell
                                    key={entry.name}
                                    fill={
                                      entry.name === "Cash"
                                        ? CASH_COLOR
                                        : ALLOCATION_PALETTE[
                                            i % ALLOCATION_PALETTE.length
                                          ]
                                    }
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  background: "var(--card)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  padding: "6px 10px",
                                  boxShadow: "none",
                                  color: "var(--foreground)",
                                }}
                                formatter={(v, n) => [
                                  `PKR ${formatPKR(Number(v), { decimals: 0 })}`,
                                  String(n),
                                ]}
                              />
                            </RechartsPie>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {allocationData.slice(0, 6).map((entry, i) => (
                            <div
                              key={entry.name}
                              className="flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="h-2 w-2 rounded-sm shrink-0"
                                  style={{
                                    background:
                                      entry.name === "Cash"
                                        ? CASH_COLOR
                                        : ALLOCATION_PALETTE[
                                            i % ALLOCATION_PALETTE.length
                                          ],
                                  }}
                                />
                                <span className="truncate text-muted-foreground">
                                  {entry.name}
                                </span>
                              </div>
                              <span className="font-tabular font-semibold">
                                {entry.pct.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Metric strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-border bg-card overflow-hidden divide-x divide-y lg:divide-y-0 divide-border animate-in-up-delay-2">
                <Metric
                  icon={<Wallet className="h-3.5 w-3.5 text-muted-foreground" />}
                  label="Cash Balance"
                  value={formatPKR(activePortfolio.cashBalance, { decimals: 0 })}
                />
                <Metric
                  icon={<BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />}
                  label="Invested"
                  value={formatPKR(totalInvested, { decimals: 0 })}
                />
                <Metric
                  icon={
                    <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                  label="Market Value"
                  value={formatPKR(totalCurrent, { decimals: 0 })}
                />
                <Metric
                  icon={
                    pnl >= 0 ? (
                      <TrendingUp
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--color-profit)" }}
                      />
                    ) : (
                      <TrendingDown
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--color-loss)" }}
                      />
                    )
                  }
                  label="Total P&L"
                  value={`${pnl >= 0 ? "+" : ""}${formatPKR(pnl, { decimals: 0 })}`}
                  valueColor={pnlColor}
                />
              </div>

              {/* Quick Trade */}
              <Card className="border border-border bg-card rounded-xl animate-in-up-delay-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                    Quick Trade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StockSearch
                    onSelect={(stock) =>
                      setTradeStock({
                        symbol: stock.symbol,
                        company: stock.company,
                        price: stock.current,
                      })
                    }
                    placeholder="Search a stock to buy or sell..."
                  />
                </CardContent>
              </Card>

              {/* Holdings Table */}
              <Card className="border border-border bg-card rounded-xl animate-in-up-delay-3">
                <CardContent className="pt-4 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold">Holdings</span>
                    </div>
                    {activePortfolio.holdings.length > 0 && (
                      <span className="text-[11px] font-tabular text-muted-foreground">
                        {activePortfolio.holdings.length} stock
                        {activePortfolio.holdings.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {activePortfolio.holdings.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="mx-auto w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                        <PackageOpen className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        No holdings yet
                      </p>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                        Use the Quick Trade section above to search and buy your
                        first stock in this portfolio.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            <th
                              className="text-left font-medium py-2 px-1 cursor-pointer select-none hover:text-foreground"
                              onClick={() => toggleSort("symbol")}
                            >
                              <span className="inline-flex items-center gap-0.5">
                                Stock
                                <SortCaret active={sortKey === "symbol"} dir={sortDir} />
                              </span>
                            </th>
                            <th className="text-center font-medium py-2 px-1 hidden md:table-cell">
                              Trend
                            </th>
                            <th className="text-right font-medium py-2 px-1 hidden sm:table-cell">
                              Qty
                            </th>
                            <th className="text-right font-medium py-2 px-1 hidden sm:table-cell">
                              Avg
                            </th>
                            <th className="text-right font-medium py-2 px-1">
                              Current
                            </th>
                            <th
                              className="text-right font-medium py-2 px-1 cursor-pointer select-none hover:text-foreground"
                              onClick={() => toggleSort("value")}
                            >
                              <span className="inline-flex items-center justify-end gap-0.5">
                                Value
                                <SortCaret active={sortKey === "value"} dir={sortDir} />
                              </span>
                            </th>
                            <th
                              className="text-right font-medium py-2 px-1 cursor-pointer select-none hover:text-foreground"
                              onClick={() => toggleSort("pnl")}
                            >
                              <span className="inline-flex items-center justify-end gap-0.5">
                                P&amp;L
                                <SortCaret active={sortKey === "pnl"} dir={sortDir} />
                              </span>
                            </th>
                            <th className="text-right font-medium py-2 px-1" />
                          </tr>
                        </thead>
                        <tbody>
                          {holdingRows.map((h) => {
                            const c =
                              h.pnl >= 0
                                ? "var(--color-profit)"
                                : "var(--color-loss)";
                            return (
                              <tr
                                key={h.id}
                                className="border-t border-border hover:bg-muted/40 transition-colors"
                              >
                                <td className="py-2.5 px-1">
                                  <Link
                                    href={`/stock/${h.symbol}`}
                                    className="block group"
                                  >
                                    <p className="font-semibold group-hover:text-primary transition-colors">
                                      {h.symbol}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                                      {h.companyName}
                                    </p>
                                  </Link>
                                </td>
                                <td className="py-2.5 px-1 hidden md:table-cell">
                                  <div className="flex justify-center">
                                    <Sparkline
                                      data={h.trend}
                                      width={72}
                                      height={24}
                                      fill
                                    />
                                  </div>
                                </td>
                                <td className="py-2.5 px-1 text-right font-tabular text-muted-foreground hidden sm:table-cell">
                                  {h.quantity.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-1 text-right font-tabular text-muted-foreground hidden sm:table-cell">
                                  {formatPKR(h.avgPrice)}
                                </td>
                                <td className="py-2.5 px-1 text-right font-tabular font-medium">
                                  {formatPKR(h.currentPrice)}
                                </td>
                                <td className="py-2.5 px-1 text-right font-tabular font-semibold">
                                  {formatPKR(h.value, { decimals: 0 })}
                                </td>
                                <td className="py-2.5 px-1 text-right">
                                  <span
                                    className="font-semibold font-tabular"
                                    style={{ color: c }}
                                  >
                                    {h.pnl >= 0 ? "+" : ""}
                                    {formatPKR(h.pnl, { decimals: 0 })}
                                  </span>
                                  <span
                                    className="block text-[11px] font-tabular"
                                    style={{ color: c }}
                                  >
                                    {h.pnlPercent >= 0 ? "+" : ""}
                                    {h.pnlPercent.toFixed(2)}%
                                  </span>
                                </td>
                                <td className="py-2.5 px-1 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7"
                                    onClick={() =>
                                      setTradeStock({
                                        symbol: h.symbol,
                                        company: h.companyName,
                                        price: h.currentPrice,
                                        portfolioId: activePortfolio.id,
                                      })
                                    }
                                  >
                                    Trade
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Create Portfolio Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
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
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Type</Label>
              <Select value={newType} onValueChange={(v) => v && setNewType(v)}>
                <SelectTrigger className="rounded-xl">
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
                className="rounded-xl font-tabular"
              />
            </div>
            <Button
              onClick={handleCreatePortfolio}
              className="w-full rounded-xl"
              disabled={!newName.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Portfolio
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Portfolio Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
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
                  className="rounded-xl"
                />
              </div>

              {/* Change Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <Select
                  value={editType}
                  onValueChange={(v) => v && setEditType(v)}
                >
                  <SelectTrigger className="rounded-xl">
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

              <Separator />

              {/* Cash Management */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Cash Management</p>
                <p className="text-xs text-muted-foreground">
                  Current balance:{" "}
                  <span className="font-tabular font-semibold text-foreground">
                    PKR {formatPKR(activePortfolio.cashBalance, { decimals: 0 })}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Add Cash
                    </Label>
                    <Input
                      type="number"
                      value={addCashAmount}
                      onChange={(e) => setAddCashAmount(e.target.value)}
                      placeholder="0"
                      className="rounded-xl font-tabular"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Remove Cash
                    </Label>
                    <Input
                      type="number"
                      value={removeCashAmount}
                      onChange={(e) => setRemoveCashAmount(e.target.value)}
                      placeholder="0"
                      className="rounded-xl font-tabular"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleEditPortfolio}
                className="w-full rounded-xl"
                disabled={editLoading}
              >
                {editLoading ? "Saving..." : "Save Changes"}
              </Button>

              <Separator />

              {/* Danger Zone */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-destructive uppercase tracking-wide">
                  Danger Zone
                </p>
                <Button
                  variant="destructive"
                  className="w-full rounded-xl"
                  onClick={handleDeletePortfolio}
                  disabled={editLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Portfolio
                </Button>
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
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p
        className="text-lg font-semibold font-tabular"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function SortCaret({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  if (!active) return <ChevronDown className="h-3 w-3 opacity-30" />;
  return dir === "desc" ? (
    <ChevronDown className="h-3 w-3" />
  ) : (
    <ChevronUp className="h-3 w-3" />
  );
}
