"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  TrendingUp,
  BarChart3,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { TradeDialog } from "@/components/TradeDialog";
import { formatPKR } from "@/lib/market-status";

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
    <tr className="border-b border-border/40">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="py-3.5 px-3">
          <div className="h-4 rounded-md bg-muted/60 animate-pulse" />
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between animate-in-up">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse all PSX listed stocks
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium border-emerald-500/30 bg-emerald-500/5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-tabular font-semibold text-emerald-600">{activeStocks.length}</span> active stocks
        </Badge>
      </div>

      {/* Quick Stats */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in-up-delay-1">
          {topGainers.length > 0 && (
            <Card className="stat-card stat-card-emerald rounded-2xl border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 to-cyan-500/5 overflow-hidden">
              <CardContent className="pt-4 pb-4 relative">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl" />
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 mb-2">
                  <div className="h-5 w-5 rounded bg-emerald-500/15 flex items-center justify-center">
                    <TrendingUp className="h-3 w-3" />
                  </div>
                  Top Gainer
                </div>
                <div className="flex items-baseline justify-between">
                  <Link
                    href={`/stock/${topGainers[0].symbol}`}
                    className="font-bold text-sm hover:text-emerald-600 transition-colors"
                  >
                    {topGainers[0].symbol}
                  </Link>
                  <span className="font-tabular text-lg font-bold text-emerald-600">
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
            <Card className="stat-card stat-card-emerald rounded-2xl border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 overflow-hidden">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 mb-2">
                  <div className="h-5 w-5 rounded bg-emerald-500/15 flex items-center justify-center">
                    <TrendingUp className="h-3 w-3" />
                  </div>
                  2nd Gainer
                </div>
                <div className="flex items-baseline justify-between">
                  <Link
                    href={`/stock/${topGainers[1].symbol}`}
                    className="font-bold text-sm hover:text-emerald-600 transition-colors"
                  >
                    {topGainers[1].symbol}
                  </Link>
                  <span className="font-tabular text-lg font-bold text-emerald-600">
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
            <Card className="stat-card stat-card-blue rounded-2xl border-blue-500/20 bg-gradient-to-br from-blue-500/8 to-violet-500/5 overflow-hidden">
              <CardContent className="pt-4 pb-4 relative">
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-2">
                  <div className="h-5 w-5 rounded bg-blue-500/15 flex items-center justify-center">
                    <BarChart3 className="h-3 w-3" />
                  </div>
                  Highest Volume
                </div>
                <div className="flex items-baseline justify-between">
                  <Link
                    href={`/stock/${topVolume.symbol}`}
                    className="font-bold text-sm hover:text-blue-600 transition-colors"
                  >
                    {topVolume.symbol}
                  </Link>
                  <span className="font-tabular text-lg font-bold text-blue-600">
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

      {/* Filters */}
      <Card className="rounded-2xl animate-in-up-delay-2">
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by symbol or company name..."
                className="pl-10 h-10 rounded-lg bg-muted/40 border-transparent focus:border-primary/30 focus:bg-background transition-colors"
              />
            </div>
            <Select
              value={sectorFilter}
              onValueChange={(v) => v && setSectorFilter(v)}
            >
              <SelectTrigger className="w-[200px] h-10 rounded-lg">
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
              <SelectTrigger className="w-[180px] h-10 rounded-lg">
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
            <p className="text-xs text-muted-foreground mt-3">
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
        </CardContent>
      </Card>

      {/* Stock Table */}
      <Card className="rounded-2xl overflow-hidden animate-in-up-delay-3">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Symbol
                  </th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Sector
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Price
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Change
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    High / Low
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Volume
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                        className="table-row-hover border-b border-border/30 last:border-0 transition-colors"
                      >
                        <td className="py-3 px-4">
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
                        <td className="py-3 px-3">
                          <span className="inline-block text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                            {s.sector}
                          </span>
                        </td>
                        <td className="text-right py-3 px-3">
                          <span className="font-tabular font-semibold">
                            {formatPKR(s.current, { decimals: 2 })}
                          </span>
                        </td>
                        <td className="text-right py-3 px-3">
                          <Badge
                            variant="secondary"
                            className={`font-tabular text-xs font-medium ${
                              s.change >= 0
                                ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15"
                                : "bg-red-500/10 text-red-500 hover:bg-red-500/15"
                            }`}
                          >
                            {s.change >= 0 ? "+" : ""}
                            {s.changePercent.toFixed(2)}%
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-3">
                          <span className="font-tabular text-xs text-muted-foreground">
                            {formatPKR(s.high, { decimals: 2 })}
                            {" / "}
                            {formatPKR(s.low, { decimals: 2 })}
                          </span>
                        </td>
                        <td className="text-right py-3 px-3">
                          <span className="font-tabular font-medium">
                            {formatPKR(s.volume, { compact: true })}
                          </span>
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="flex gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-8 w-8 p-0 rounded-lg transition-colors ${
                                watchedSymbols.has(s.symbol)
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "hover:bg-amber-500/10 hover:text-amber-500 text-muted-foreground"
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
                              className="h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-3 text-xs font-semibold gap-1.5 shadow-sm"
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
