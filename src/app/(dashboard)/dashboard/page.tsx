"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  LayoutGrid,
  RefreshCw,
  Plus,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { formatPKR, getMarketStatus } from "@/lib/market-status";
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

/* ────────────────────────── types ────────────────────────── */

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
  company?: string;
  sector?: string;
  current: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface ModelPortfolio {
  id: string;
  name: string;
  cashBalance: number;
  allocations: {
    symbol: string;
    companyName: string;
    percentage: number;
    shares: number;
    avgPrice: number;
  }[];
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

/* Avatar tint palette (per ticker) — multi-series, never used for P&L. */
const TINTS = [
  "#2563EB",
  "#7C3AED",
  "#0D9488",
  "#DB2777",
  "#CA8A04",
  "#0891B2",
  "#4F46E5",
  "#DC2626",
];
const ALLOC_COLORS = ["#7C3AED", "#0D9488", "#2563EB", "#0891B2", "#CA8A04", "#DB2777"];
const CASH_COLOR = "#CBD5E1";

const RANGES = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;
type Range = (typeof RANGES)[number];
const RANGE_DAYS: Record<Range, number> = {
  "1D": 2,
  "1W": 6,
  "1M": 22,
  "3M": 66,
  "1Y": 252,
  ALL: Infinity,
};

function tint(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

function loadWidgets(): WidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  try {
    const saved = localStorage.getItem("psx-dashboard-widgets");
    if (saved) {
      const parsed = JSON.parse(saved) as WidgetConfig[];
      const ids = new Set(parsed.map((w) => w.id));
      const merged = [...parsed];
      for (const d of DEFAULT_WIDGETS) if (!ids.has(d.id)) merged.push(d);
      return merged;
    }
  } catch {}
  return DEFAULT_WIDGETS;
}

/** Count-up animation for the hero figure (honors reduced motion). */
function useCountUp(target: number, ms = 900) {
  const [n, setN] = useState(target);
  const raf = useRef(0);
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (prefersReduced || target === 0) {
      setN(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setN(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms, prefersReduced]);
  return n;
}

/* ────────────────────────── page ────────────────────────── */

export default function DashboardPage() {
  const [kse100, setKse100] = useState<KSE100 | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [marketData, setMarketData] = useState<MarketStock[]>([]);
  const [modelPortfolios, setModelPortfolios] = useState<ModelPortfolio[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);
  const [balancesHidden, setBalancesHidden] = useState(false);
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});
  const [range, setRange] = useState<Range>("1M");
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    setWidgets(loadWidgets());
    try {
      setBalancesHidden(localStorage.getItem("psx-hide-balances") === "1");
    } catch {}
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const name = d?.user?.name;
        if (name) setUserName(String(name).split(" ")[0]);
      })
      .catch(() => {});
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
    try {
      localStorage.setItem("psx-dashboard-widgets", JSON.stringify(updated));
    } catch {}
  };
  const toggleWidget = (id: WidgetId) =>
    saveWidgets(widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  const moveWidget = (id: WidgetId, dir: "up" | "down") => {
    const idx = widgets.findIndex((w) => w.id === id);
    if (idx < 0) return;
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= widgets.length) return;
    const u = [...widgets];
    [u[idx], u[j]] = [u[j], u[idx]];
    saveWidgets(u);
  };
  const isVisible = (id: WidgetId) =>
    widgets.find((w) => w.id === id)?.visible !== false;

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
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const uniqueSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const p of portfolios) for (const h of p.holdings) set.add(h.symbol);
    return Array.from(set).slice(0, 12);
  }, [portfolios]);

  useEffect(() => {
    if (uniqueSymbols.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        uniqueSymbols.map(async (sym) => {
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
      const map: Record<string, HistoryPoint[]> = {};
      for (const [sym, data] of results) map[sym] = data;
      setHistory(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [uniqueSymbols]);

  const priceMap = useMemo(
    () => new Map(marketData.map((s) => [s.symbol, s.current])),
    [marketData]
  );
  const companyMap = useMemo(
    () => new Map(marketData.map((s) => [s.symbol, s.company])),
    [marketData]
  );

  const totalInvested = portfolios.reduce(
    (sum, p) => sum + p.holdings.reduce((s, h) => s + h.avgPrice * h.quantity, 0),
    0
  );
  const totalCurrentValue = portfolios.reduce(
    (sum, p) =>
      sum +
      p.holdings.reduce((s, h) => {
        const cp = priceMap.get(h.symbol) || h.avgPrice;
        return s + cp * h.quantity;
      }, 0),
    0
  );
  const totalCash = portfolios.reduce((sum, p) => sum + p.cashBalance, 0);
  const totalValue = totalCurrentValue + totalCash;
  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  // Today's P&L from live day-change of each holding.
  const todayPnL = useMemo(() => {
    let sum = 0;
    const changeMap = new Map(marketData.map((s) => [s.symbol, s.change]));
    for (const p of portfolios)
      for (const h of p.holdings)
        sum += (changeMap.get(h.symbol) || 0) * h.quantity;
    return sum;
  }, [portfolios, marketData]);
  const todayPnLPct =
    totalCurrentValue > 0 ? (todayPnL / (totalCurrentValue - todayPnL)) * 100 : 0;

  const sortedByChange = useMemo(
    () =>
      [...marketData]
        .filter((s) => s.current > 0)
        .sort((a, b) => b.changePercent - a.changePercent),
    [marketData]
  );
  const topGainers = sortedByChange.slice(0, 4);
  const topLosers = sortedByChange.slice(-4).reverse();

  // Sector averages for the KSE strip (live, from market data).
  const sectorMovers = useMemo(() => {
    const groups = new Map<string, { sum: number; n: number }>();
    for (const s of marketData) {
      if (!s.sector || !Number.isFinite(s.changePercent)) continue;
      const g = groups.get(s.sector) || { sum: 0, n: 0 };
      g.sum += s.changePercent;
      g.n += 1;
      groups.set(s.sector, g);
    }
    return Array.from(groups.entries())
      .map(([name, g]) => ({ name, pct: g.sum / g.n, count: g.n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [marketData]);

  const allHoldings = useMemo(
    () => portfolios.flatMap((p) => p.holdings),
    [portfolios]
  );

  // Portfolio value-over-time series (weighted by shares + cash).
  const fullValueSeries = useMemo<{ date: string; value: number }[]>(() => {
    if (allHoldings.length === 0) return [];
    const shares = new Map<string, number>();
    const avg = new Map<string, number>();
    for (const h of allHoldings) {
      shares.set(h.symbol, (shares.get(h.symbol) || 0) + h.quantity);
      if (!avg.has(h.symbol)) avg.set(h.symbol, h.avgPrice);
    }
    const dateSet = new Set<string>();
    for (const sym of shares.keys())
      for (const pt of history[sym] || []) dateSet.add(pt.date);
    const dates = Array.from(dateSet).sort();
    if (dates.length < 2) return [];
    const sortedHist: Record<string, HistoryPoint[]> = {};
    for (const sym of shares.keys())
      sortedHist[sym] = [...(history[sym] || [])].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
    return dates.map((date) => {
      let value = totalCash;
      for (const [sym, qty] of shares) {
        const hist = sortedHist[sym] || [];
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

  const valueSeries = useMemo(() => {
    const days = RANGE_DAYS[range];
    return days === Infinity ? fullValueSeries : fullValueSeries.slice(-days);
  }, [fullValueSeries, range]);

  // Allocation donut.
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
  }, [allHoldings, priceMap, totalCash]);

  const holdingCount = allHoldings.length;

  // Holdings rows.
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
      return {
        ...h,
        company: companyMap.get(h.symbol) || h.companyName,
        currentPrice,
        value,
        pnl,
        pnlPercent,
        trend,
      };
    });
    rows.sort((a, b) => b.value - a.value);
    return rows.slice(0, 8);
  }, [allHoldings, priceMap, companyMap, history]);

  // Per-model metrics + trend.
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
        .map((a) => ({ symbol: a.symbol, pct: a.percentage }))
        .sort((x, y) => y.pct - x.pct);

      return { ...m, total, invested, pnl, pnlPct, stockCount, cashPct, trend, bars };
    });
  }, [modelPortfolios, priceMap, history]);

  const heroVal = useCountUp(totalValue);
  const market = getMarketStatus();
  const up = totalPnL >= 0;
  const todayUp = todayPnL >= 0;

  const blur = (s: string) => (balancesHidden ? "balance-blur" : s);

  return (
    <>
      {/* Page header */}
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            Welcome back{userName ? `, ${userName}` : ""}
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleBalances}
            className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04]"
          >
            {balancesHidden ? <EyeOff className="h-[15px] w-[15px]" /> : <Eye className="h-[15px] w-[15px]" />}
            {balancesHidden ? "Show" : "Hide"}
          </button>
          <button
            onClick={() => setShowWidgetSettings((v) => !v)}
            className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04]"
          >
            <LayoutGrid className="h-[15px] w-[15px]" />
            Widgets
          </button>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex h-[38px] items-center gap-2 rounded-[10px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105 disabled:opacity-70"
          >
            <RefreshCw className={`h-[15px] w-[15px] ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Widget settings */}
      {showWidgetSettings && (
        <div className="mb-[18px] rounded-2xl border border-line bg-card p-[18px] shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
              Dashboard Widgets
            </p>
            <button
              onClick={() => setShowWidgetSettings(false)}
              className="text-[12px] font-medium text-ink-3 hover:text-ink"
            >
              Done
            </button>
          </div>
          <div className="space-y-1.5">
            {widgets.map((w, idx) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-[10px] border border-line bg-canvas px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleWidget(w.id)}
                    className={`rounded-md p-1 ${w.visible ? "text-brand" : "text-ink-3"} hover:bg-ink/[.04]`}
                  >
                    {w.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <span
                    className={`text-sm font-medium ${!w.visible ? "text-ink-3 line-through" : ""}`}
                  >
                    {w.label}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => moveWidget(w.id, "up")}
                    disabled={idx === 0}
                    className="rounded-md p-1 text-ink-3 hover:bg-ink/[.04] disabled:opacity-30"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveWidget(w.id, "down")}
                    disabled={idx === widgets.length - 1}
                    className="rounded-md p-1 text-ink-3 hover:bg-ink/[.04] disabled:opacity-30"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KSE-100 strip */}
      {isVisible("kse100") && (
        <div className="mb-[18px] flex items-center gap-6 overflow-x-auto rounded-2xl border border-line bg-card px-[22px] py-3.5 shadow-card">
          <div className="flex shrink-0 items-center gap-3">
            <span className="relative h-[9px] w-[9px]">
              <span className="absolute inset-0 rounded-full bg-gain" />
              <span className="ping-dot absolute inset-0 rounded-full bg-gain" />
            </span>
            <div>
              <div className="text-[11px] font-semibold tracking-[.04em] text-ink-3">
                KSE-100 INDEX
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="num text-[19px] font-bold tracking-[-.02em]">
                  {kse100 ? formatPKR(kse100.current, { decimals: 2 }) : "—"}
                </span>
                {kse100 && (
                  <span
                    className="num text-[12.5px] font-semibold"
                    style={{ color: kse100.change >= 0 ? "var(--color-gain)" : "var(--color-loss-strong)" }}
                  >
                    {kse100.change >= 0 ? "+" : ""}
                    {formatPKR(kse100.change, { decimals: 2 })} ({kse100.changePercent >= 0 ? "+" : ""}
                    {kse100.changePercent.toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
          {sectorMovers.length > 0 && (
            <>
              <div className="h-[34px] w-px shrink-0 bg-line" />
              <div className="flex shrink-0 gap-5">
                {sectorMovers.map((s) => (
                  <div key={s.name} className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium text-ink-3">{s.name}</span>
                    <span
                      className="num text-[12.5px] font-semibold"
                      style={{ color: s.pct >= 0 ? "var(--color-gain)" : "var(--color-loss-strong)" }}
                    >
                      {s.pct >= 0 ? "+" : ""}
                      {s.pct.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="flex-1" />
          <div className="flex shrink-0 flex-col items-end gap-[3px]">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
              style={{
                color: market.status === "open" ? "var(--color-gain)" : "var(--color-ink-2)",
                background: market.status === "open" ? "var(--color-gain-50)" : "var(--color-line-soft)",
              }}
            >
              <span
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: market.status === "open" ? "var(--color-gain)" : "var(--color-ink-3)" }}
              />
              {market.label}
            </span>
            <span className="text-[10.5px] font-medium text-ink-3">{market.nextEvent}</span>
          </div>
        </div>
      )}

      {/* Hero value + Allocation */}
      {isVisible("stats") && (
        <div className="mb-[18px] grid gap-[18px] lg:grid-cols-[1.55fr_1fr]">
          {/* Portfolio value */}
          <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 text-[13px] font-medium text-ink-2">
                  Total Portfolio Value
                </div>
                <div className={`num whitespace-nowrap text-[42px] font-bold leading-none tracking-[-.035em] ${blur("")}`}>
                  Rs {formatPKR(heroVal, { decimals: 0 })}
                </div>
                <div className="mt-3 flex items-center gap-2.5">
                  <span
                    className="num inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1 text-[13px] font-semibold"
                    style={{
                      color: todayUp ? "var(--color-gain)" : "var(--color-loss-strong)",
                      background: todayUp ? "var(--color-gain-50)" : "var(--color-loss-50)",
                    }}
                  >
                    {todayUp ? "▲" : "▼"}{" "}
                    <span className={blur("")}>
                      Rs {formatPKR(Math.abs(todayPnL), { decimals: 0 })}
                    </span>{" "}
                    ({todayUp ? "+" : "−"}
                    {Math.abs(todayPnLPct).toFixed(2)}%)
                  </span>
                  <span className="text-[13px] text-ink-3">today</span>
                </div>
              </div>
              <div className="flex gap-1 rounded-[11px] bg-canvas p-1">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-lg px-[11px] py-[5px] text-[12px] font-semibold transition-colors ${
                      range === r ? "bg-brand text-white" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="-mx-1.5 -mb-1 mt-3.5 h-[168px]">
              {valueSeries.length >= 2 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={valueSeries} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity={0.26} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis domain={["dataMin", "dataMax"]} hide />
                    <Tooltip
                      cursor={{ stroke: "var(--color-line)", strokeWidth: 1 }}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-line)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "var(--color-ink)",
                        boxShadow: "var(--shadow-pop)",
                      }}
                      labelFormatter={() => ""}
                      formatter={(v) => [`Rs ${formatPKR(Number(v), { decimals: 0 })}`, "Value"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#059669"
                      strokeWidth={2.2}
                      fill="url(#heroFill)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#059669" }}
                      isAnimationActive
                      animationDuration={1100}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-ink-3">
                    {allHoldings.length === 0
                      ? "Add holdings to see value over time"
                      : "Building price history…"}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Allocation donut */}
          <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
            <div className="text-[14px] font-semibold">Allocation</div>
            <div className="mb-3.5 mt-0.5 text-[12px] text-ink-3">By market value</div>
            {allocationData.length === 0 ? (
              <div className="flex h-[140px] items-center justify-center">
                <p className="text-xs text-ink-3">No allocation yet</p>
              </div>
            ) : (
              <div className="flex items-center gap-[18px]">
                <div className="relative h-[140px] w-[140px] shrink-0">
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
                            fill={e.name === "Cash" ? CASH_COLOR : ALLOC_COLORS[i % ALLOC_COLORS.length]}
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
                        formatter={(v, n) => [`Rs ${formatPKR(Number(v), { decimals: 0 })}`, String(n)]}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <div className="text-[11px] text-ink-3">Holdings</div>
                      <div className="num text-[19px] font-bold">{holdingCount}</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-[9px]">
                  {allocationData.slice(0, 5).map((e, i) => (
                    <div key={e.name} className="flex items-center gap-[9px]">
                      <span
                        className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
                        style={{
                          background: e.name === "Cash" ? CASH_COLOR : ALLOC_COLORS[i % ALLOC_COLORS.length],
                        }}
                      />
                      <span className="flex-1 text-[12px] font-medium">{e.name}</span>
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
      )}

      {/* Stat strip */}
      {isVisible("stats") && (
        <div className="mb-[26px] grid grid-cols-2 gap-[18px] lg:grid-cols-4">
          <StatCard
            label="Invested"
            value={`Rs ${formatPKR(totalInvested, { decimals: 0 })}`}
            sub="Cost basis"
            iconBg="bg-brand/10"
            iconColor="text-brand"
            hidden={balancesHidden}
            icon={
              <path
                d="M4 7h16v10H4zM4 7l8-4 8 4"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            }
          />
          <StatCard
            label="Cash"
            value={`Rs ${formatPKR(totalCash, { decimals: 0 })}`}
            sub="Available"
            iconBg="bg-[#7C3AED]/10"
            iconColor="text-[#7C3AED]"
            hidden={balancesHidden}
            icon={
              <path
                d="M3 7h18v10H3zM3 11h18"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            }
          />
          <StatCard
            label="Today's P&L"
            value={`${todayUp ? "+" : "−"}Rs ${formatPKR(Math.abs(todayPnL), { decimals: 0 })}`}
            subNode={
              <span
                className="num text-[12px] font-semibold"
                style={{ color: todayUp ? "var(--color-gain)" : "var(--color-loss-strong)" }}
              >
                {todayUp ? "+" : "−"}
                {Math.abs(todayPnLPct).toFixed(2)}%
              </span>
            }
            iconBg="bg-gain-50"
            iconColor="text-gain"
            hidden={balancesHidden}
            icon={
              <path
                d="M4 16 L10 9 L14 13 L20 6"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            }
          />
          <StatCard
            label="Total Return"
            value={`${up ? "+" : "−"}${Math.abs(totalPnLPercent).toFixed(2)}%`}
            valueColor={up ? "var(--color-gain)" : "var(--color-loss-strong)"}
            subNode={
              <span className={`num text-[12px] text-ink-3 ${blur("")}`}>
                {up ? "+" : "−"}Rs {formatPKR(Math.abs(totalPnL), { decimals: 0 })}
              </span>
            }
            iconBg={up ? "bg-gain-50" : "bg-loss-50"}
            iconColor={up ? "text-gain" : "text-loss-strong"}
            icon={
              <path
                d="M12 3v18M7 8l5-5 5 5"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            }
          />
        </div>
      )}

      {/* Model portfolios */}
      {isVisible("models") && (
        <>
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[18px] font-bold tracking-[-.02em]">Model Portfolios</h2>
              <span className="rounded-full bg-brand/10 px-2 py-[3px] text-[11px] font-semibold text-brand">
                FLAGSHIP
              </span>
            </div>
            <Link
              href="/models"
              className="flex items-center gap-1 text-[13px] font-medium text-brand"
            >
              {modelMetrics.length > 0 ? "View all" : "New Model"}
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>
          {modelMetrics.length === 0 ? (
            <Link
              href="/models"
              className="mb-[26px] flex items-center justify-center rounded-2xl border border-dashed border-line bg-card py-10 text-[13px] font-medium text-ink-3 shadow-card hover:text-ink"
            >
              <Plus className="mr-2 h-4 w-4" /> Create your first model portfolio
            </Link>
          ) : (
            <div className="mb-[26px] grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
              {modelMetrics.slice(0, 3).map((m) => {
                const mUp = m.pnl >= 0;
                return (
                  <Link
                    key={m.id}
                    href={`/models/${m.id}`}
                    className="group rounded-2xl border border-line bg-card p-[22px] shadow-card transition hover:-translate-y-[3px] hover:border-brand hover:shadow-[0_12px_34px_rgba(13,18,28,.10)]"
                  >
                    <div className="flex items-start justify-between gap-2.5">
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
                    <div className={`num mb-0.5 mt-2.5 text-[27px] font-bold tracking-[-.03em] ${blur("")}`}>
                      Rs {formatPKR(m.total, { decimals: 0 })}
                    </div>
                    <div className={`text-[12px] text-ink-2 ${blur("")}`}>
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
        </>
      )}

      {/* Holdings + movers */}
      {(isVisible("holdings") || isVisible("gainers") || isVisible("losers")) && (
        <div className="grid gap-[18px] lg:grid-cols-[1.7fr_1fr]">
          {/* Holdings */}
          {isVisible("holdings") && (
            <section className="rounded-2xl border border-line bg-card pb-2 shadow-card">
              <div className="flex items-center justify-between px-[22px] pb-3 pt-[22px]">
                <h2 className="text-[16px] font-bold tracking-[-.02em]">Holdings</h2>
                <Link href="/portfolio" className="text-[12px] text-ink-3 hover:text-ink">
                  {holdingRows.length} position{holdingRows.length !== 1 ? "s" : ""}
                </Link>
              </div>
              {holdingRows.length === 0 ? (
                <div className="px-[22px] py-12 text-center">
                  <p className="text-sm font-medium text-ink-3">No holdings yet</p>
                  <Link href="/market" className="mt-1 inline-block text-[13px] font-medium text-brand">
                    Browse market to buy stocks
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[2.3fr_1fr_1.1fr_1.1fr] border-b border-line px-[22px] pb-2 text-[11px] font-semibold tracking-[.03em] text-ink-3">
                    <span>STOCK</span>
                    <span className="text-right">TREND</span>
                    <span className="text-right">VALUE</span>
                    <span className="text-right">P&L</span>
                  </div>
                  {holdingRows.map((h, idx) => {
                    const hUp = h.pnl >= 0;
                    const c = tint(h.symbol);
                    const last = idx === holdingRows.length - 1;
                    return (
                      <Link
                        key={h.id}
                        href={`/stock/${h.symbol}`}
                        className={`grid grid-cols-[2.3fr_1fr_1.1fr_1.1fr] items-center px-[22px] py-[11px] hover:bg-ink/[.03] ${last ? "" : "border-b border-line-soft"}`}
                      >
                        <div className="flex min-w-0 items-center gap-[11px]">
                          <span
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[12px] font-bold"
                            style={{ background: `${c}22`, color: c }}
                          >
                            {h.symbol.slice(0, 2)}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-semibold">{h.symbol}</div>
                            <div className="truncate text-[11.5px] text-ink-3">{h.company}</div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <div className="h-7 w-[72px]">
                            {h.trend.length >= 2 ? (
                              <Sparkline
                                data={h.trend}
                                width={72}
                                height={28}
                                strokeWidth={1.8}
                                color={hUp ? "var(--color-gain)" : "var(--color-loss-strong)"}
                                className="h-full w-full"
                              />
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`num text-[13.5px] font-semibold ${blur("")}`}>
                            Rs {formatPKR(h.value, { decimals: 0 })}
                          </div>
                          <div className="num text-[11.5px] text-ink-3">{h.quantity} sh</div>
                        </div>
                        <div className="flex items-center justify-end">
                          <span
                            className="num rounded-lg px-2.5 py-1 text-[12.5px] font-semibold"
                            style={{
                              color: hUp ? "var(--color-gain)" : "var(--color-loss-strong)",
                              background: hUp ? "var(--color-gain-50)" : "var(--color-loss-50)",
                            }}
                          >
                            {hUp ? "+" : ""}
                            {h.pnlPercent.toFixed(2)}%
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </>
              )}
            </section>
          )}

          {/* Movers */}
          {(isVisible("gainers") || isVisible("losers")) && (
            <div className="flex flex-col gap-[18px]">
              {isVisible("gainers") && (
                <MoverList title="Top Gainers" stocks={topGainers} positive />
              )}
              {isVisible("losers") && (
                <MoverList title="Top Losers" stocks={topLosers} positive={false} />
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ────────────────────────── sub-components ────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  subNode,
  valueColor,
  iconBg,
  iconColor,
  icon,
  hidden,
}: {
  label: string;
  value: string;
  sub?: string;
  subNode?: React.ReactNode;
  valueColor?: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  hidden?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
      <div className="mb-2.5 flex items-center gap-2">
        <span className={`grid h-[26px] w-[26px] place-items-center rounded-lg ${iconBg} ${iconColor}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            {icon}
          </svg>
        </span>
        <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
      </div>
      <div
        className={`num text-[23px] font-bold tracking-[-.025em] ${hidden ? "balance-blur" : ""}`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {subNode ? (
        <div className="mt-1">{subNode}</div>
      ) : (
        <div className="mt-1 text-[12px] text-ink-3">{sub}</div>
      )}
    </div>
  );
}

function MoverList({
  title,
  stocks,
  positive,
}: {
  title: string;
  stocks: MarketStock[];
  positive: boolean;
}) {
  const color = positive ? "var(--color-gain)" : "var(--color-loss-strong)";
  const bg = positive ? "var(--color-gain-50)" : "var(--color-loss-50)";
  return (
    <section className="rounded-2xl border border-line bg-card pb-2 shadow-card">
      <div className="flex items-center gap-2 px-[22px] pb-3 pt-[22px]">
        {positive ? (
          <TrendingUp className="h-4 w-4" style={{ color }} />
        ) : (
          <TrendingDown className="h-4 w-4" style={{ color }} />
        )}
        <h2 className="text-[15px] font-bold">{title}</h2>
      </div>
      {stocks.length === 0 ? (
        <p className="px-[22px] py-6 text-center text-sm text-ink-3">Loading…</p>
      ) : (
        stocks.map((s) => (
          <Link
            key={s.symbol}
            href={`/stock/${s.symbol}`}
            className="flex items-center justify-between px-[22px] py-[9px] hover:bg-ink/[.03]"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-8 w-8 place-items-center rounded-[9px] text-[11px] font-bold"
                style={{ color, background: bg }}
              >
                {s.symbol.slice(0, 2)}
              </span>
              <div>
                <div className="text-[13px] font-semibold">{s.symbol}</div>
                <div className="num text-[11px] text-ink-3">
                  Rs {formatPKR(s.current, { decimals: 1 })}
                </div>
              </div>
            </div>
            <span
              className="num rounded-lg px-2.5 py-1 text-[12px] font-semibold"
              style={{ color, background: bg }}
            >
              {s.changePercent >= 0 ? "+" : ""}
              {s.changePercent.toFixed(2)}%
            </span>
          </Link>
        ))
      )}
    </section>
  );
}
