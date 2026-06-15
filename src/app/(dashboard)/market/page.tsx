"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  ArrowUpDown,
  Eye,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { TradeDialog } from "@/components/TradeDialog";
import { formatPKR } from "@/lib/market-status";
import { PageSkeleton } from "@/components/ui/skeleton";

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

function ShimmerRow() {
  return (
    <tr className="border-b border-border/60">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="py-2.5 px-3">
          <div className="h-3.5 rounded bg-muted animate-pulse" />
        </td>
      ))}
    </tr>
  );
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

  const sectors = useMemo(() => {
    const s = new Set(stocks.map((s) => s.sector).filter(Boolean));
    return Array.from(s).sort();
  }, [stocks]);

  const activeStocks = useMemo(
    () => stocks.filter((s) => s.current > 0),
    [stocks]
  );

  const filteredStocks = useMemo(() => {
    let result = activeStocks;

    if (search) {
      const q = search.toUpperCase();
      result = result.filter(
        (s) =>
          s.symbol.toUpperCase().includes(q) ||
          s.company.toUpperCase().includes(q)
      );
    }

    if (sectorFilter !== "all") {
      result = result.filter((s) => s.sector === sectorFilter);
    }

    result.sort((a, b) => {
      let diff = 0;
      if (sortBy === "symbol") diff = a.symbol.localeCompare(b.symbol);
      else if (sortBy === "change") diff = a.changePercent - b.changePercent;
      else diff = a.volume - b.volume;
      return sortDir === "desc" ? -diff : diff;
    });

    return result;
  }, [activeStocks, search, sectorFilter, sortBy, sortDir]);

  const [watchedSymbols, setWatchedSymbols] = useState<Set<string>>(new Set());

  // Load existing watchlist
  useEffect(() => {
    fetch("/api/watchlist")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWatchedSymbols(new Set(data.map((w: { symbol: string }) => w.symbol)));
        }
      })
      .catch(() => {});
  }, []);

  const handleAddToWatchlist = async (symbol: string, company: string) => {
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, companyName: company }),
    });
    if (res.ok) {
      setWatchedSymbols((prev) => new Set(prev).add(symbol));
    }
  };

  const isLoading = stocks.length === 0;

  const topGainers = useMemo(
    () => [...activeStocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3),
    [activeStocks]
  );

  const topVolume = useMemo(
    () => [...activeStocks].sort((a, b) => b.volume - a.volume).slice(0, 1)[0],
    [activeStocks]
  );

  if (initialLoading) return <PageSkeleton />;

  // ── Sortable column header helper ───────────────────────────────
  const toggleSort = (col: "symbol" | "change" | "volume") => {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const sortIndicator = (col: "symbol" | "change" | "volume") =>
    sortBy === col ? (
      <span className="text-primary">{sortDir === "desc" ? "↓" : "↑"}</span>
    ) : (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between animate-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse all PSX listed stocks
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border bg-card rounded-lg px-3 py-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-profit)] opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-profit)]" />
          </span>
          <span className="font-tabular font-semibold text-foreground">
            {activeStocks.length}
          </span>{" "}
          active
        </div>
      </div>

      {/* Quick Stats */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in-up-delay-1">
          {topGainers.length > 0 && (
            <Card className="border border-border bg-card rounded-xl">
              <CardContent className="py-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Top Gainer
                </p>
                <div className="flex items-baseline justify-between mt-2">
                  <Link
                    href={`/stock/${topGainers[0].symbol}`}
                    className="font-semibold text-sm hover:text-primary transition-colors"
                  >
                    {topGainers[0].symbol}
                  </Link>
                  <span
                    className="font-tabular text-lg font-semibold"
                    style={{ color: "var(--color-profit)" }}
                  >
                    +{topGainers[0].changePercent.toFixed(2)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {topGainers[0].company}
                </p>
              </CardContent>
            </Card>
          )}
          {topGainers.length > 1 && (
            <Card className="border border-border bg-card rounded-xl">
              <CardContent className="py-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  2nd Gainer
                </p>
                <div className="flex items-baseline justify-between mt-2">
                  <Link
                    href={`/stock/${topGainers[1].symbol}`}
                    className="font-semibold text-sm hover:text-primary transition-colors"
                  >
                    {topGainers[1].symbol}
                  </Link>
                  <span
                    className="font-tabular text-lg font-semibold"
                    style={{ color: "var(--color-profit)" }}
                  >
                    +{topGainers[1].changePercent.toFixed(2)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {topGainers[1].company}
                </p>
              </CardContent>
            </Card>
          )}
          {topVolume && (
            <Card className="border border-border bg-card rounded-xl">
              <CardContent className="py-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Highest Volume
                </p>
                <div className="flex items-baseline justify-between mt-2">
                  <Link
                    href={`/stock/${topVolume.symbol}`}
                    className="font-semibold text-sm hover:text-primary transition-colors"
                  >
                    {topVolume.symbol}
                  </Link>
                  <span className="font-tabular text-lg font-semibold text-foreground">
                    {formatPKR(topVolume.volume, { compact: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {topVolume.company}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="animate-in-up-delay-2 flex flex-wrap gap-2.5 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by symbol or company name..."
            className="pl-10 h-9 rounded-lg border border-border bg-card focus:border-primary/40 transition-colors"
          />
        </div>
        <Select
          value={sectorFilter}
          onValueChange={(v) => v && setSectorFilter(v)}
        >
          <SelectTrigger className="w-[200px] h-9 rounded-lg border border-border bg-card">
            <SelectValue placeholder="All Sectors">
              {(value: string | null) => (!value || value === "all") ? "All Sectors" : value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sectors</SelectItem>
            {sectors.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={`${sortBy}-${sortDir}`}
          onValueChange={(v) => {
            if (!v) return;
            const [by, dir] = v.split("-") as [
              "symbol" | "change" | "volume",
              "asc" | "desc",
            ];
            setSortBy(by);
            setSortDir(dir);
          }}
        >
          <SelectTrigger className="w-[180px] h-9 rounded-lg border border-border bg-card">
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue>
              {(value: string | null) => {
                const labels: Record<string, string> = {
                  "volume-desc": "Volume (High)", "volume-asc": "Volume (Low)",
                  "change-desc": "Gainers", "change-asc": "Losers",
                  "symbol-asc": "Symbol (A-Z)", "symbol-desc": "Symbol (Z-A)",
                };
                return value ? (labels[value] || value) : "Sort by";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="volume-desc">Volume (High)</SelectItem>
            <SelectItem value="volume-asc">Volume (Low)</SelectItem>
            <SelectItem value="change-desc">Gainers</SelectItem>
            <SelectItem value="change-asc">Losers</SelectItem>
            <SelectItem value="symbol-asc">Symbol (A-Z)</SelectItem>
            <SelectItem value="symbol-desc">Symbol (Z-A)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && (
        <p className="text-xs text-muted-foreground -mt-2">
          Showing{" "}
          <span className="font-tabular font-medium text-foreground">
            {Math.min(filteredStocks.length, 100)}
          </span>{" "}
          of{" "}
          <span className="font-tabular font-medium text-foreground">
            {filteredStocks.length}
          </span>{" "}
          results
        </p>
      )}

      {/* Stock Table */}
      <Card className="border border-border bg-card rounded-xl overflow-hidden animate-in-up-delay-3">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-2.5 px-4">
                    <button
                      onClick={() => toggleSort("symbol")}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Symbol {sortIndicator("symbol")}
                    </button>
                  </th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Sector
                  </th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Price
                  </th>
                  <th className="text-right py-2.5 px-3">
                    <button
                      onClick={() => toggleSort("change")}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Change {sortIndicator("change")}
                    </button>
                  </th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    High / Low
                  </th>
                  <th className="text-right py-2.5 px-3">
                    <button
                      onClick={() => toggleSort("volume")}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    >
                      Volume {sortIndicator("volume")}
                    </button>
                  </th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 12 }).map((_, i) => (
                      <ShimmerRow key={i} />
                    ))
                  : filteredStocks.slice(0, 100).map((s) => (
                      <tr
                        key={s.symbol}
                        className="table-row-hover border-b border-border/60 last:border-0 transition-colors"
                      >
                        <td className="py-2.5 px-4">
                          <Link
                            href={`/stock/${s.symbol}`}
                            className="group inline-block"
                          >
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {s.symbol}
                            </span>
                            <br />
                            <span className="text-xs text-muted-foreground line-clamp-1 max-w-[180px]">
                              {s.company}
                            </span>
                          </Link>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block text-xs text-muted-foreground border border-border rounded-md px-2 py-0.5">
                            {s.sector}
                          </span>
                        </td>
                        <td className="text-right py-2.5 px-3">
                          <span className="font-tabular font-semibold">
                            {formatPKR(s.current, { decimals: 2 })}
                          </span>
                        </td>
                        <td className="text-right py-2.5 px-3">
                          <span
                            className="inline-flex font-tabular text-xs font-semibold rounded-md px-2 py-0.5"
                            style={{
                              color:
                                s.change >= 0
                                  ? "var(--color-profit)"
                                  : "var(--color-loss)",
                              backgroundColor:
                                s.change >= 0
                                  ? "var(--color-profit-bg)"
                                  : "var(--color-loss-bg)",
                            }}
                          >
                            {s.change >= 0 ? "+" : ""}
                            {s.changePercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="text-right py-2.5 px-3">
                          <span className="font-tabular text-xs text-muted-foreground">
                            {formatPKR(s.high, { decimals: 2 })}
                            {" / "}
                            {formatPKR(s.low, { decimals: 2 })}
                          </span>
                        </td>
                        <td className="text-right py-2.5 px-3">
                          <span className="font-tabular font-medium">
                            {formatPKR(s.volume, { compact: true })}
                          </span>
                        </td>
                        <td className="text-right py-2.5 px-4">
                          <div className="flex gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-8 w-8 p-0 rounded-lg transition-colors ${
                                watchedSymbols.has(s.symbol)
                                  ? "bg-primary/10 text-primary"
                                  : "hover:bg-muted text-muted-foreground"
                              }`}
                              onClick={() =>
                                handleAddToWatchlist(s.symbol, s.company)
                              }
                              title={
                                watchedSymbols.has(s.symbol)
                                  ? "In Watchlist"
                                  : "Add to Watchlist"
                              }
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 rounded-lg px-3 text-xs font-semibold gap-1.5"
                              onClick={() => setTradeStock(s)}
                            >
                              <ShoppingCart className="h-3.5 w-3.5" />
                              Trade
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!isLoading && filteredStocks.length === 0 && (
              <div className="text-center py-16">
                <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm font-medium">
                  No stocks found
                </p>
                <p className="text-muted-foreground/60 text-xs mt-1">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
