"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Trash2,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Star,
} from "lucide-react";
import Link from "next/link";
import { StockSearch } from "@/components/StockSearch";
import { TradeDialog } from "@/components/TradeDialog";
import { formatPKR } from "@/lib/market-status";
import { PageSkeleton } from "@/components/ui/skeleton";

interface WatchlistItem {
  id: string;
  symbol: string;
  companyName: string;
}

interface MarketStock {
  symbol: string;
  company: string;
  current: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
}

interface Portfolio {
  id: string;
  name: string;
  cashBalance: number;
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [marketData, setMarketData] = useState<Map<string, MarketStock>>(
    new Map()
  );
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [tradeStock, setTradeStock] = useState<MarketStock | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [watchRes, marketRes, portfolioRes] = await Promise.all([
      fetch("/api/watchlist"),
      fetch("/api/psx"),
      fetch("/api/portfolios"),
    ]);

    if (watchRes.ok) setWatchlist(await watchRes.json());
    if (marketRes.ok) {
      const data = await marketRes.json();
      const map = new Map<string, MarketStock>();
      if (Array.isArray(data)) {
        data.forEach((s: MarketStock) => map.set(s.symbol, s));
      }
      setMarketData(map);
    }
    if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRemove = async (symbol: string) => {
    await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, {
      method: "DELETE",
    });
    fetchData();
  };

  const handleAdd = async (stock: { symbol: string; company: string }) => {
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: stock.symbol,
        companyName: stock.company,
      }),
    });
    fetchData();
  };

  if (initialLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2.5">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-amber-500/10">
            <Eye className="h-5 w-5 text-amber-500" />
          </div>
          Watchlist
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track stocks you&apos;re interested in
        </p>
      </div>

      {/* Search Card */}
      <Card className="rounded-xl shadow-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Add to Watchlist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StockSearch
            onSelect={(stock) => handleAdd(stock)}
            placeholder="Search and add stocks to watchlist..."
          />
        </CardContent>
      </Card>

      {/* Watchlist Items */}
      <Card className="rounded-xl shadow-sm border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Watching
            </CardTitle>
            <Badge variant="secondary" className="text-xs font-tabular">
              {watchlist.length} {watchlist.length === 1 ? "stock" : "stocks"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted/50 mb-4">
                <Star className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Your watchlist is empty
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Search and add stocks above to start tracking
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {watchlist.map((item) => {
                const stock = marketData.get(item.symbol);
                const isGain = stock ? stock.change >= 0 : true;

                return (
                  <div
                    key={item.id}
                    className="table-row-hover flex items-center justify-between p-3 rounded-xl transition-colors"
                  >
                    <Link
                      href={`/stock/${item.symbol}`}
                      className="flex-1 min-w-0 hover:text-primary transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/5 shrink-0">
                          <BarChart3 className="h-4 w-4 text-primary/70" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-sm">
                            {item.symbol}
                          </span>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.companyName}
                          </p>
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center gap-3">
                      {stock ? (
                        <>
                          <div className="text-right">
                            <p className="text-sm font-semibold font-tabular">
                              PKR {formatPKR(stock.current)}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-tabular">
                              Vol: {stock.volume.toLocaleString()}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-xs font-semibold font-tabular px-2 py-0.5 rounded-md ${
                              isGain
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-red-500/10 text-red-600 dark:text-red-400"
                            }`}
                          >
                            {isGain ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {isGain ? "+" : ""}
                            {stock.changePercent.toFixed(2)}%
                          </Badge>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground animate-pulse">
                          Loading...
                        </span>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                        onClick={() => {
                          if (stock) setTradeStock(stock);
                        }}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                        onClick={() => handleRemove(item.symbol)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
