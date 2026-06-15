"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Activity,
  PieChart,
  Banknote,
  Layers,
  Settings2,
  EyeOff,
  Eye,
  ChevronUp,
  ChevronDown,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatPKR } from "@/lib/market-status";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/Sparkline";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from "recharts";

interface KSE100 {
  current: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
}

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
  cashBalance: number;
  holdings: Holding[];
}

interface MarketStock {
  symbol: string;
  current: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface ModelPortfolio {
  id: string;
  name: string;
  cashBalance: number;
  allocations: { symbol: string; companyName: string; percentage: number; shares: number; avgPrice: number }[];
}

interface HistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type WidgetId = "kse100" | "stats" | "models" | "holdings" | "gainers" | "losers";

interface WidgetConfig {
  id: WidgetId;
  label: string;
  visible: boolean;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "kse100", label: "KSE-100 Index", visible: true },
  { id: "stats", label: "Portfolio Stats", visible: true },
  { id: "models", label: "Model Portfolios", visible: true },
  { id: "holdings", label: "My Holdings", visible: true },
  { id: "gainers", label: "Top Gainers", visible: true },
  { id: "losers", label: "Top Losers", visible: true },
];

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

function loadWidgets(): WidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  try {
    const saved = localStorage.getItem("psx-dashboard-widgets");
    if (saved) {
      const parsed = JSON.parse(saved) as WidgetConfig[];
      // Merge with defaults to handle new widgets
      const ids = new Set(parsed.map((w) => w.id));
      const merged = [...parsed];
      for (const d of DEFAULT_WIDGETS) {
        if (!ids.has(d.id)) merged.push(d);
      }
      return merged;
    }
  } catch {}
  return DEFAULT_WIDGETS;
}

type SortKey = "value" | "pnl";

export default function DashboardPage() {
  const [kse100, setKse100] = useState<KSE100 | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [marketData, setMarketData] = useState<MarketStock[]>([]);
  const [modelPortfolios, setModelPortfolios] = useState<ModelPortfolio[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);
  const [balancesHidden, setBalancesHidden] = useState(false);
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setWidgets(loadWidgets());
    try {
      setBalancesHidden(localStorage.getItem("psx-hide-balances") === "1");
    } catch {}
  }, []);

  const toggleBalances = () => {
    setBalancesHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("psx-hide-balances", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const saveWidgets = (updated: WidgetConfig[]) => {
    setWidgets(updated);
    localStorage.setItem("psx-dashboard-widgets", JSON.stringify(updated));
  };

  const toggleWidget = (id: WidgetId) => {
    saveWidgets(
      widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  };

  const moveWidget = (id: WidgetId, direction: "up" | "down") => {
    const idx = widgets.findIndex((w) => w.id === id);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= widgets.length) return;
    const updated = [...widgets];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    saveWidgets(updated);
  };

  const isVisible = (id: WidgetId) => widgets.find((w) => w.id === id)?.visible !== false;

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [kseRes, portfolioRes, marketRes, modelsRes] = await Promise.all([
        fetch("/api/psx?action=kse100"),
        fetch("/api/portfolios"),
        fetch("/api/psx"),
        fetch("/api/model-portfolios"),
      ]);

      if (kseRes.ok) setKse100(await kseRes.json());
      if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
      if (marketRes.ok) {
        const data = await marketRes.json();
        setMarketData(Array.isArray(data) ? data : []);
      }
      if (modelsRes.ok) setModelPortfolios(await modelsRes.json());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Unique holding symbols (capped to limit history requests)
  const uniqueSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const p of portfolios) for (const h of p.holdings) set.add(h.symbol);
    return Array.from(set).slice(0, 12);
  }, [portfolios]);

  // Fetch per-symbol price history once portfolios load
  useEffect(() => {
    if (uniqueSymbols.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        uniqueSymbols.map(async (sym) => {
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
  }, [uniqueSymbols]);

  const priceMap = new Map(marketData.map((s) => [s.symbol, s.current]));

  const totalInvested = portfolios.reduce(
    (sum, p) =>
      sum + p.holdings.reduce((hSum, h) => hSum + h.avgPrice * h.quantity, 0),
    0
  );

  const totalCurrentValue = portfolios.reduce(
    (sum, p) =>
      sum +
      p.holdings.reduce((hSum, h) => {
        const cp = priceMap.get(h.symbol) || h.avgPrice;
        return hSum + cp * h.quantity;
      }, 0),
    0
  );

  const totalCash = portfolios.reduce((sum, p) => sum + p.cashBalance, 0);
  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPercent =
    totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  const sortedByChange = [...marketData]
    .filter((s) => s.current > 0)
    .sort((a, b) => b.changePercent - a.changePercent);
  const topGainers = sortedByChange.slice(0, 5);
  const topLosers = sortedByChange.slice(-5).reverse();

  // Flat list of all holdings (across portfolios)
  const allHoldings = useMemo(
    () => portfolios.flatMap((p) => p.holdings),
    [portfolios]
  );

  // ---- Portfolio value-over-time series (weighted by shares) ----
  const valueSeries = useMemo<{ date: string; value: number }[]>(() => {
    if (allHoldings.length === 0) return [];
    // Aggregate shares per symbol
    const shares = new Map<string, number>();
    const avg = new Map<string, number>();
    for (const h of allHoldings) {
      shares.set(h.symbol, (shares.get(h.symbol) || 0) + h.quantity);
      if (!avg.has(h.symbol)) avg.set(h.symbol, h.avgPrice);
    }

    // Union of trading dates across all fetched histories
    const dateSet = new Set<string>();
    for (const sym of shares.keys()) {
      for (const pt of history[sym] || []) dateSet.add(pt.date);
    }
    const dates = Array.from(dateSet).sort().slice(-30); // last ~30 trading days
    if (dates.length < 2) return [];

    // Per-symbol sorted history for "most recent close on/before date" lookup
    const sortedHist: Record<string, HistoryPoint[]> = {};
    for (const sym of shares.keys()) {
      sortedHist[sym] = [...(history[sym] || [])].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
    }

    return dates.map((date) => {
      let value = totalCash;
      for (const [sym, qty] of shares) {
        const hist = sortedHist[sym] || [];
        // most recent close on/before this date
        let close = avg.get(sym) || 0;
        for (let i = hist.length - 1; i >= 0; i--) {
          if (hist[i].date <= date && hist[i].close > 0) {
            close = hist[i].close;
            break;
          }
        }
        value += qty * close;
      }
      return { date, value };
    });
  }, [allHoldings, history, totalCash]);

  // ---- Allocation donut data ----
  const allocationData = useMemo(() => {
    const bySymbol = new Map<string, number>();
    for (const h of allHoldings) {
      const cp = priceMap.get(h.symbol) || h.avgPrice;
      bySymbol.set(h.symbol, (bySymbol.get(h.symbol) || 0) + cp * h.quantity);
    }
    const slices = Array.from(bySymbol.entries())
      .map(([symbol, value]) => ({ name: symbol, value }))
      .sort((a, b) => b.value - a.value);
    if (totalCash > 0) slices.push({ name: "Cash", value: totalCash });
    const total = slices.reduce((s, x) => s + x.value, 0) || 1;
    return slices.map((s) => ({ ...s, pct: (s.value / total) * 100 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allHoldings, marketData, totalCash]);

  // ---- Holdings table rows (sortable) ----
  const holdingRows = useMemo(() => {
    const rows = allHoldings.map((h) => {
      const currentPrice = priceMap.get(h.symbol) || h.avgPrice;
      const value = currentPrice * h.quantity;
      const pnl = (currentPrice - h.avgPrice) * h.quantity;
      const pnlPercent =
        h.avgPrice > 0 ? ((currentPrice - h.avgPrice) / h.avgPrice) * 100 : 0;
      const trend = (history[h.symbol] || [])
        .map((p) => p.close)
        .filter((n) => n > 0)
        .slice(-20);
      return { ...h, currentPrice, value, pnl, pnlPercent, trend };
    });
    rows.sort((a, b) => {
      const av = sortKey === "value" ? a.value : a.pnl;
      const bv = sortKey === "value" ? b.value : b.pnl;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return rows.slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allHoldings, marketData, history, sortKey, sortDir]);

  // Per-model metrics: market value, invested, P&L, stock count, and a
  // value-over-time trend series (built from the same per-symbol history).
  const modelMetrics = useMemo(() => {
    return modelPortfolios.map((m) => {
      const stocks = m.allocations.filter((a) => a.symbol !== "CASH");
      let invested = 0;
      let marketValue = 0;
      for (const a of stocks) {
        const cur = priceMap.get(a.symbol) || a.avgPrice;
        invested += a.avgPrice * a.shares;
        marketValue += cur * a.shares;
      }
      const totalValue = marketValue + m.cashBalance;
      const pnl = marketValue - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
      const stockCount = stocks.filter((a) => a.shares > 0).length;

      // Trend: union of recent dates, sum shares*close (+cash) per date
      const dateSet = new Set<string>();
      for (const a of stocks) {
        for (const pt of history[a.symbol] || []) dateSet.add(pt.date);
      }
      const dates = Array.from(dateSet).sort().slice(-20);
      const closeOnOrBefore: Record<string, { date: string; close: number }[]> = {};
      for (const a of stocks) {
        closeOnOrBefore[a.symbol] = [...(history[a.symbol] || [])].sort((x, y) =>
          x.date < y.date ? -1 : 1
        );
      }
      const trend = dates.map((d) => {
        let v = m.cashBalance;
        for (const a of stocks) {
          const hist = closeOnOrBefore[a.symbol] || [];
          let close = a.avgPrice;
          for (const pt of hist) {
            if (pt.date <= d && pt.close > 0) close = pt.close;
            else if (pt.date > d) break;
          }
          v += close * a.shares;
        }
        return v;
      });

      return { ...m, totalValue, invested, pnl, pnlPct, stockCount, trend };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelPortfolios, marketData, history]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (initialLoading) {
    return (
      <div className="space-y-8 lg:space-y-10">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  const pnlColor = totalPnL >= 0 ? "var(--color-profit)" : "var(--color-loss)";

  return (
    <div className="space-y-8 lg:space-y-10">
      {/* Header */}
      <div className="flex items-end justify-between animate-in-up">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm lg:text-base mt-1">
            Your portfolio overview and market summary
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleBalances}
            className="h-8 text-xs gap-1.5"
            title={balancesHidden ? "Show balances" : "Hide balances"}
          >
            {balancesHidden ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
            {balancesHidden ? "Show" : "Hide"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWidgetSettings(!showWidgetSettings)}
            className="h-8 text-xs gap-1.5"
          >
            <Settings2 className="h-3 w-3" />
            Widgets
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={refreshing}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw
              className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Widget Settings Panel */}
      {showWidgetSettings && (
        <Card className="rounded-xl border border-border bg-card animate-in-up">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dashboard Widgets
              </p>
              <button
                onClick={() => setShowWidgetSettings(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Done
              </button>
            </div>
            <div className="space-y-1.5">
              {widgets.map((widget, idx) => (
                <div
                  key={widget.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleWidget(widget.id)}
                      className={`p-1 rounded-md transition-colors ${
                        widget.visible
                          ? "text-primary hover:bg-muted"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {widget.visible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                    <span
                      className={`text-sm font-medium ${!widget.visible ? "text-muted-foreground line-through" : ""}`}
                    >
                      {widget.label}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveWidget(widget.id, "up")}
                      disabled={idx === 0}
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveWidget(widget.id, "down")}
                      disabled={idx === widgets.length - 1}
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hero: portfolio value + value-over-time chart */}
      {isVisible("stats") && (
        <div className="rounded-xl border border-border bg-card overflow-hidden animate-in-up-delay-1">
          <div className="flex flex-col lg:flex-row">
            <div className="p-7 lg:p-9 lg:w-[34%] lg:border-r border-border">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  Portfolio Value
                </span>
              </div>
              <p
                className={`text-4xl lg:text-5xl font-semibold font-tabular tracking-tight ${balancesHidden ? "balance-blur" : ""}`}
              >
                {formatPKR(totalCurrentValue, { decimals: 0 })}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold font-tabular"
                  style={{
                    color: pnlColor,
                    backgroundColor:
                      totalPnL >= 0
                        ? "var(--color-profit-bg)"
                        : "var(--color-loss-bg)",
                  }}
                >
                  {totalPnL >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {totalPnLPercent >= 0 ? "+" : ""}
                  {totalPnLPercent.toFixed(2)}%
                </span>
                <span
                  className={`text-xs font-medium font-tabular ${balancesHidden ? "balance-blur" : ""}`}
                  style={{ color: pnlColor }}
                >
                  {totalPnL >= 0 ? "+" : ""}
                  {formatPKR(totalPnL, { decimals: 0 })}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Across {portfolios.length} portfolio{portfolios.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex-1 h-52 lg:h-auto min-h-[240px] px-2 pb-2 pt-4 lg:py-6 lg:pr-6">
              {valueSeries.length >= 2 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={valueSeries} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                    <defs>
                      <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      hide
                    />
                    <YAxis domain={["dataMin", "dataMax"]} hide />
                    <Tooltip
                      cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        padding: "6px 10px",
                        boxShadow: "none",
                        color: "var(--foreground)",
                      }}
                      labelStyle={{ color: "var(--muted-foreground)", marginBottom: 2 }}
                      formatter={(v) => [`PKR ${formatPKR(Number(v), { decimals: 0 })}`, "Value"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#heroFill)"
                      dot={false}
                      activeDot={{ r: 3, fill: "var(--primary)" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full min-h-[150px] flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">
                    {allHoldings.length === 0
                      ? "Add holdings to see value over time"
                      : "Building price history…"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metric strip */}
      {isVisible("stats") && (
        <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-border bg-card overflow-hidden divide-x divide-y lg:divide-y-0 divide-border animate-in-up-delay-2">
          <Metric
            icon={<Wallet className="h-3.5 w-3.5 text-muted-foreground" />}
            label="Cash"
            value={formatPKR(totalCash, { decimals: 0 })}
            hidden={balancesHidden}
          />
          <Metric
            icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}
            label="Invested"
            value={formatPKR(totalInvested, { decimals: 0 })}
            hidden={balancesHidden}
          />
          <Metric
            icon={
              totalPnL >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" style={{ color: "var(--color-profit)" }} />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" style={{ color: "var(--color-loss)" }} />
              )
            }
            label="Total P&L"
            value={`${totalPnL >= 0 ? "+" : ""}${formatPKR(totalPnL, { decimals: 0 })}`}
            valueColor={pnlColor}
            hidden={balancesHidden}
          />
          {isVisible("kse100") ? (
            <Metric
              icon={
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className="relative inline-flex rounded-full h-1.5 w-1.5"
                    style={{
                      background: kse100 && kse100.change >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                    }}
                  />
                </span>
              }
              label="KSE-100"
              value={kse100?.current ? formatPKR(kse100.current, { decimals: 0 }) : "—"}
              sub={
                kse100 ? (
                  <span style={{ color: kse100.change >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}>
                    {kse100.changePercent >= 0 ? "+" : ""}
                    {kse100.changePercent.toFixed(2)}%
                  </span>
                ) : undefined
              }
            />
          ) : (
            <Metric
              icon={<Activity className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Holdings"
              value={String(allHoldings.length)}
            />
          )}
        </div>
      )}

      {/* Allocation donut + Holdings table */}
      {isVisible("holdings") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 animate-in-up-delay-3">
          {/* Allocation donut */}
          <Card className="border border-border bg-card rounded-xl">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <PieChart className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold">Allocation</span>
              </div>
              {allocationData.length === 0 ? (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">No allocation yet</p>
                </div>
              ) : (
                <>
                  <div className="h-44">
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
                                  : ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length]
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
                  <div className="mt-3 space-y-1.5">
                    {allocationData.slice(0, 6).map((entry, i) => (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2 w-2 rounded-sm shrink-0"
                            style={{
                              background:
                                entry.name === "Cash"
                                  ? CASH_COLOR
                                  : ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length],
                            }}
                          />
                          <span className="truncate text-muted-foreground">{entry.name}</span>
                        </div>
                        <span className="font-tabular font-semibold">{entry.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Holdings table */}
          <Card className="lg:col-span-2 border border-border bg-card rounded-xl">
            <CardContent className="pt-4 pb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold">My Holdings</span>
                </div>
                <Link href="/portfolio">
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground hover:text-foreground">
                    View All
                  </Button>
                </Link>
              </div>

              {holdingRows.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Briefcase className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No holdings yet</p>
                  <Link href="/market">
                    <Button variant="link" size="sm" className="mt-1 text-xs">
                      Browse market to buy stocks
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="text-left font-medium py-2 px-1">Stock</th>
                        <th className="text-center font-medium py-2 px-1 hidden sm:table-cell">Trend</th>
                        <th
                          className="text-right font-medium py-2 px-1 cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleSort("value")}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            Value
                            <SortCaret active={sortKey === "value"} dir={sortDir} />
                          </span>
                        </th>
                        <th
                          className="text-right font-medium py-2 px-1 cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleSort("pnl")}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            P&amp;L
                            <SortCaret active={sortKey === "pnl"} dir={sortDir} />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdingRows.map((h) => {
                        const c = h.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)";
                        return (
                          <tr
                            key={h.id}
                            className="border-t border-border hover:bg-muted/40 transition-colors"
                          >
                            <td className="py-2.5 px-1">
                              <Link href={`/stock/${h.symbol}`} className="block group">
                                <p className="font-semibold group-hover:text-primary transition-colors">
                                  {h.symbol}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-tabular">
                                  {h.quantity} @ {h.avgPrice.toFixed(2)}
                                </p>
                              </Link>
                            </td>
                            <td className="py-2.5 px-1 hidden sm:table-cell">
                              <div className="flex justify-center">
                                <Sparkline data={h.trend} width={72} height={24} fill />
                              </div>
                            </td>
                            <td className="py-2.5 px-1 text-right">
                              <span className={`font-semibold font-tabular ${balancesHidden ? "balance-blur" : ""}`}>
                                {formatPKR(h.value, { decimals: 0 })}
                              </span>
                            </td>
                            <td className="py-2.5 px-1 text-right">
                              <span
                                className={`font-semibold font-tabular ${balancesHidden ? "balance-blur" : ""}`}
                                style={{ color: c }}
                              >
                                {h.pnl >= 0 ? "+" : ""}
                                {formatPKR(h.pnl, { decimals: 0 })}
                              </span>
                              <span className="block text-[11px] font-tabular" style={{ color: c }}>
                                {h.pnlPercent >= 0 ? "+" : ""}
                                {h.pnlPercent.toFixed(1)}%
                              </span>
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

      {/* Model Portfolios */}
      {isVisible("models") && modelPortfolios.length > 0 && (
        <div className="animate-in-up-delay-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              Model Portfolios
            </h2>
            <Link href="/models">
              <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground hover:text-foreground">
                View All
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modelMetrics.slice(0, 3).map((model) => {
              const up = model.pnl >= 0;
              return (
                <Link key={model.id} href={`/models/${model.id}`}>
                  <Card className="border border-border bg-card rounded-xl cursor-pointer hover:border-primary/40 transition-colors h-full">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{model.name}</p>
                          <p className={`text-xl font-semibold font-tabular mt-1 ${balancesHidden ? "balance-blur" : ""}`}>
                            PKR {formatPKR(model.totalValue, { decimals: 0 })}
                          </p>
                        </div>
                        {model.trend.length >= 2 && (
                          <Sparkline data={model.trend} width={72} height={32} fill />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className="text-xs font-medium font-tabular px-1.5 py-0.5 rounded-md"
                          style={{
                            color: up ? "var(--color-profit)" : "var(--color-loss)",
                            backgroundColor: up ? "var(--color-profit-bg)" : "var(--color-loss-bg)",
                          }}
                        >
                          {up ? "+" : ""}{formatPKR(model.pnl, { decimals: 0 })} ({up ? "+" : ""}{model.pnlPct.toFixed(1)}%)
                        </span>
                      </div>

                      <div className="h-1.5 bg-muted rounded-full overflow-hidden flex mt-3 mb-2">
                        {model.allocations.map((a, i) => {
                          const color =
                            a.symbol === "CASH"
                              ? CASH_COLOR
                              : ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length];
                          return (
                            <div
                              key={a.symbol}
                              className="h-full"
                              style={{ width: `${a.percentage}%`, background: color }}
                            />
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{model.stockCount} stocks</span>
                        <span className="font-tabular">
                          PKR {formatPKR(model.cashBalance, { compact: true })} cash
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Gainers / Top Losers */}
      {(isVisible("gainers") || isVisible("losers")) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 animate-in-up-delay-4">
          {isVisible("gainers") && (
            <MoverList
              title="Top Gainers"
              icon={<ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />}
              stocks={topGainers}
              positive
            />
          )}
          {isVisible("losers") && (
            <MoverList
              title="Top Losers"
              icon={<ArrowDownRight className="h-3.5 w-3.5 text-muted-foreground" />}
              stocks={topLosers}
              positive={false}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  valueColor,
  hidden,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
  valueColor?: string;
  hidden?: boolean;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p
        className={`text-2xl font-semibold font-tabular ${hidden ? "balance-blur" : ""}`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-xs font-medium font-tabular mt-1">{sub}</p>}
    </div>
  );
}

function SortCaret({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronDown className="h-3 w-3 opacity-30" />;
  return dir === "desc" ? (
    <ChevronDown className="h-3 w-3" />
  ) : (
    <ChevronUp className="h-3 w-3" />
  );
}

function MoverList({
  title,
  icon,
  stocks,
  positive,
}: {
  title: string;
  icon: React.ReactNode;
  stocks: MarketStock[];
  positive: boolean;
}) {
  const color = positive ? "var(--color-profit)" : "var(--color-loss)";
  const bg = positive ? "var(--color-profit-bg)" : "var(--color-loss-bg)";
  return (
    <Card className="border border-border bg-card rounded-xl">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <div className="divide-y divide-border">
          {stocks.map((s, i) => (
            <Link
              key={s.symbol}
              href={`/stock/${s.symbol}`}
              className="flex items-center justify-between py-2.5 group"
            >
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-tabular text-muted-foreground w-4 text-right">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold group-hover:text-primary transition-colors">
                  {s.symbol}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-tabular text-muted-foreground">
                  {s.current.toFixed(2)}
                </span>
                <span
                  className="text-[11px] font-semibold font-tabular px-2 py-0.5 rounded-md min-w-[58px] text-center"
                  style={{ color, backgroundColor: bg }}
                >
                  {s.changePercent >= 0 ? "+" : ""}
                  {s.changePercent.toFixed(2)}%
                </span>
              </div>
            </Link>
          ))}
          {stocks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
