"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Trash2,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
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
      <div className="flex items-end justify-between animate-in-up">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card">
            <Eye className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Track stocks you&apos;re interested in
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground font-tabular">
          {watchlist.length} {watchlist.length === 1 ? "stock" : "stocks"}
        </span>
      </div>

      {/* Add to Watchlist */}
      <div className="border border-border bg-card rounded-xl p-4 animate-in-up-delay-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2.5">
          Add to Watchlist
        </p>
        <StockSearch
          onSelect={(stock) => handleAdd(stock)}
          placeholder="Search and add stocks to watchlist..."
        />
      </div>

      {/* Watchlist Items */}
      <div className="border border-border bg-card rounded-xl overflow-hidden animate-in-up-delay-2">
        {watchlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl border border-border bg-card mb-4">
              <Star className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Your watchlist is empty</p>
            <p className="text-xs text-muted-foreground mt-1">
              Search and add stocks above to start tracking
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 px-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Symbol
                </th>
                <th className="text-right py-2.5 px-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Price
                </th>
                <th className="text-right py-2.5 px-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Change
                </th>
                <th className="text-right py-2.5 px-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                  Volume
                </th>
                <th className="py-2.5 px-4 w-px" />
              </tr>
            </thead>
            <tbody>
              {watchlist.map((item) => {
                const stock = marketData.get(item.symbol);
                const isGain = stock ? stock.change >= 0 : true;

                return (
                  <tr
                    key={item.id}
                    className="table-row-hover border-b border-border last:border-0 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <Link
                        href={`/stock/${item.symbol}`}
                        className="block min-w-0 hover:text-primary transition-colors"
                      >
                        <span className="font-semibold">{item.symbol}</span>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {item.companyName}
                        </p>
                      </Link>
                    </td>
                    <td className="text-right py-3 px-4">
                      {stock ? (
                        <span className="font-tabular font-semibold">
                          PKR {formatPKR(stock.current)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground animate-pulse">
                          Loading...
                        </span>
                      )}
                    </td>
                    <td className="text-right py-3 px-4">
                      {stock && (
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold font-tabular"
                          style={{
                            color: isGain
                              ? "var(--color-profit)"
                              : "var(--color-loss)",
                            background: isGain
                              ? "var(--color-profit-bg)"
                              : "var(--color-loss-bg)",
                          }}
                        >
                          {isGain ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {isGain ? "+" : ""}
                          {stock.changePercent.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="text-right py-3 px-4 text-xs text-muted-foreground font-tabular hidden sm:table-cell">
                      {stock ? stock.volume.toLocaleString() : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
