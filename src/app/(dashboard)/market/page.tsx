"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Star, ArrowLeftRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { TradeDialog } from "@/components/TradeDialog";
import { formatPKR } from "@/lib/market-status";
import { sectorName } from "@/lib/sectors";

interface MarketStock {
  symbol: string;
  company: string;
  sector: string;
  open: number;
  high: number;
  low: number;
  current: number;
  change: number;
  changePercent: number;
  volume: number;
  ldcp: number;
}

interface Portfolio {
  id: string;
  name: string;
  cashBalance: number;
}

const TINTS = ["#2563EB", "#7C3AED", "#0D9488", "#DB2777", "#CA8A04", "#0891B2", "#16A34A", "#4F46E5"];
function tint(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export default function MarketPage() {
  const [stocks, setStocks] = useState<MarketStock[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"symbol" | "change" | "volume">("volume");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tradeStock, setTradeStock] = useState<MarketStock | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [watchedSymbols, setWatchedSymbols] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const [marketRes, portfolioRes] = await Promise.all([
      fetch("/api/psx"),
      fetch("/api/portfolios"),
    ]);
    if (marketRes.ok) {
      const data = await marketRes.json();
      setStocks(Array.isArray(data) ? data : []);
    }
    if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data))
          setWatchedSymbols(new Set(data.map((w: { symbol: string }) => w.symbol)));
      })
      .catch(() => {});
  }, []);

  const activeStocks = useMemo(() => stocks.filter((s) => s.current > 0), [stocks]);

  const sectors = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of stocks) if (s.sector) map.set(s.sector, sectorName(s.sector));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    let result = activeStocks;
    if (search) {
      const q = search.toUpperCase();
      result = result.filter(
        (s) => s.symbol.toUpperCase().includes(q) || s.company.toUpperCase().includes(q)
      );
    }
    if (sectorFilter !== "all") result = result.filter((s) => s.sector === sectorFilter);
    result = [...result].sort((a, b) => {
      let diff = 0;
      if (sortBy === "symbol") diff = a.symbol.localeCompare(b.symbol);
      else if (sortBy === "change") diff = a.changePercent - b.changePercent;
      else diff = a.volume - b.volume;
      return sortDir === "desc" ? -diff : diff;
    });
    return result;
  }, [activeStocks, search, sectorFilter, sortBy, sortDir]);

  const handleAddToWatchlist = async (symbol: string, company: string) => {
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, companyName: company }),
    });
    if (res.ok) setWatchedSymbols((prev) => new Set(prev).add(symbol));
  };

  const topGainers = useMemo(
    () => [...activeStocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 2),
    [activeStocks]
  );
  const topVolume = useMemo(
    () => [...activeStocks].sort((a, b) => b.volume - a.volume)[0],
    [activeStocks]
  );

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            All Pakistan Stock Exchange listings
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">Market</h1>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-3">
          <span className="h-2 w-2 rounded-full bg-gain" />
          Live · {activeStocks.length} symbols
        </div>
      </div>

      {/* Quick stats */}
      <div className="mb-[18px] grid gap-[18px] sm:grid-cols-3">
        <QuickStat label="Top Gainer" stock={topGainers[0]} kind="change" />
        <QuickStat label="2nd Gainer" stock={topGainers[1]} kind="change" />
        <QuickStat label="Highest Volume" stock={topVolume} kind="volume" />
      </div>

      {/* Toolbar */}
      <div className="mb-[18px] flex flex-wrap gap-2.5">
        <label className="relative flex min-w-[200px] flex-1 items-center">
          <Search className="absolute left-3.5 h-[15px] w-[15px] opacity-50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol or company…"
            className="h-10 w-full rounded-[10px] border border-line bg-card pl-9 pr-3 text-[13px] shadow-card outline-none focus:border-brand"
          />
        </label>
        <div className="relative">
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="h-10 appearance-none rounded-[10px] border border-line bg-card pl-3.5 pr-9 text-[13px] font-medium shadow-card outline-none focus:border-brand"
          >
            <option value="all">All Sectors</option>
            {sectors.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
        </div>
        <div className="relative">
          <select
            value={`${sortBy}-${sortDir}`}
            onChange={(e) => {
              const [by, dir] = e.target.value.split("-") as [
                "symbol" | "change" | "volume",
                "asc" | "desc",
              ];
              setSortBy(by);
              setSortDir(dir);
            }}
            className="h-10 appearance-none rounded-[10px] border border-line bg-card pl-3.5 pr-9 text-[13px] font-medium shadow-card outline-none focus:border-brand"
          >
            <option value="volume-desc">Sort: Volume (High)</option>
            <option value="volume-asc">Sort: Volume (Low)</option>
            <option value="change-desc">Sort: Gainers</option>
            <option value="change-asc">Sort: Losers</option>
            <option value="symbol-asc">Sort: Symbol (A-Z)</option>
            <option value="symbol-desc">Sort: Symbol (Z-A)</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
        </div>
      </div>

      {/* Table */}
      <section className="rounded-2xl border border-line bg-card pb-2 pt-[22px] shadow-card">
        <div className="grid grid-cols-[1.6fr_1.1fr_1fr_1fr_1.2fr_1fr_92px] gap-2 border-b border-line px-[22px] pb-2.5 text-[11px] font-semibold tracking-[.03em] text-ink-3">
          <span>SYMBOL</span>
          <span>SECTOR</span>
          <span className="text-right">PRICE</span>
          <span className="text-right">CHANGE</span>
          <span className="text-right">HIGH / LOW</span>
          <span className="text-right">VOLUME</span>
          <span className="text-right">ACTIONS</span>
        </div>

        {initialLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.6fr_1.1fr_1fr_1fr_1.2fr_1fr_92px] gap-2 border-b border-line-soft px-[22px] py-2.5"
            >
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="h-4 animate-pulse rounded bg-line-soft" />
              ))}
            </div>
          ))
        ) : filteredStocks.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="mx-auto mb-3 h-9 w-9 text-ink-3 opacity-50" />
            <p className="text-sm font-medium text-ink-2">No stocks found</p>
            <p className="mt-1 text-xs text-ink-3">Try adjusting your search or filter</p>
          </div>
        ) : (
          filteredStocks.slice(0, 100).map((s) => {
            const c = tint(s.symbol);
            const sUp = s.change >= 0;
            const watched = watchedSymbols.has(s.symbol);
            return (
              <div
                key={s.symbol}
                className="grid grid-cols-[1.6fr_1.1fr_1fr_1fr_1.2fr_1fr_92px] items-center gap-2 border-b border-line-soft px-[22px] py-2.5 hover:bg-ink/[.03]"
              >
                <Link href={`/stock/${s.symbol}`} className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] text-[9.9px] font-bold"
                    style={{ background: `${c}22`, color: c }}
                  >
                    {s.symbol.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{s.symbol}</div>
                    <div className="truncate text-[11px] text-ink-3">{s.company}</div>
                  </div>
                </Link>
                <span className="truncate text-[12px] text-ink-2">{sectorName(s.sector)}</span>
                <span className="num text-right text-[13px] font-semibold">
                  {formatPKR(s.current, { decimals: 2 })}
                </span>
                <span
                  className="num text-right text-[12.5px] font-semibold"
                  style={{ color: sUp ? "var(--color-gain)" : "var(--color-loss-strong)" }}
                >
                  {sUp ? "+" : ""}
                  {s.changePercent.toFixed(2)}%
                </span>
                <span className="num text-right text-[11.5px] text-ink-3">
                  {formatPKR(s.high, { decimals: 1 })} / {formatPKR(s.low, { decimals: 1 })}
                </span>
                <span className="num text-right text-[12px] text-ink-2">
                  {formatPKR(s.volume, { compact: true })}
                </span>
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => handleAddToWatchlist(s.symbol, s.company)}
                    title={watched ? "In watchlist" : "Add to watchlist"}
                    className={`grid h-[30px] w-[30px] place-items-center rounded-lg border border-line ${
                      watched ? "bg-brand/10 text-brand" : "text-ink-3 hover:bg-ink/[.04]"
                    }`}
                  >
                    <Star className="h-[14px] w-[14px]" fill={watched ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={() => setTradeStock(s)}
                    title="Trade"
                    className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-line text-brand hover:bg-ink/[.04]"
                  >
                    <ArrowLeftRight className="h-[14px] w-[14px]" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      {tradeStock && (
        <TradeDialog
          open={!!tradeStock}
          onOpenChange={(open) => !open && setTradeStock(null)}
          symbol={tradeStock.symbol}
          companyName={tradeStock.company}
          currentPrice={tradeStock.current}
          portfolios={portfolios}
          onSuccess={fetchData}
        />
      )}
    </>
  );
}

function QuickStat({
  label,
  stock,
  kind,
}: {
  label: string;
  stock?: MarketStock;
  kind: "change" | "volume";
}) {
  if (!stock) {
    return (
      <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
        <div className="mb-3 text-[12px] font-medium text-ink-2">{label}</div>
        <div className="h-10 animate-pulse rounded bg-line-soft" />
      </div>
    );
  }
  const c = tint(stock.symbol);
  const up = stock.change >= 0;
  return (
    <Link href={`/stock/${stock.symbol}`} className="rounded-2xl border border-line bg-card p-[22px] shadow-card hover:border-brand">
      <div className="mb-3 text-[12px] font-medium text-ink-2">{label}</div>
      <div className="flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[13px] font-bold"
          style={{ background: `${c}22`, color: c }}
        >
          {stock.symbol.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold">{stock.symbol}</div>
          <div className="truncate text-[11.5px] text-ink-3">{stock.company}</div>
        </div>
        <div className="text-right">
          <div className="num text-[15px] font-bold">
            {formatPKR(stock.current, { decimals: 1 })}
          </div>
          {kind === "change" ? (
            <span
              className="num rounded-lg px-2.5 py-1 text-[12.5px] font-semibold"
              style={{
                color: up ? "var(--color-gain)" : "var(--color-loss-strong)",
                background: up ? "var(--color-gain-50)" : "var(--color-loss-50)",
              }}
            >
              {up ? "+" : ""}
              {stock.changePercent.toFixed(2)}%
            </span>
          ) : (
            <div className="num text-[12px] text-ink-3">
              {formatPKR(stock.volume, { compact: true })} vol
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
