"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, ArrowLeftRight, X } from "lucide-react";
import Link from "next/link";
import { StockSearch } from "@/components/StockSearch";
import { TradeDialog } from "@/components/TradeDialog";
import { formatPKR } from "@/lib/market-status";

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

const TINTS = ["#2563EB", "#7C3AED", "#0D9488", "#DB2777", "#CA8A04", "#0891B2", "#16A34A", "#4F46E5"];
function tint(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [marketData, setMarketData] = useState<Map<string, MarketStock>>(
    new Map()
  );
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [tradeStock, setTradeStock] = useState<MarketStock | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);

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
    setShowSearch(false);
    fetchData();
  };

  const count = watchlist.length;

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            {count} tracked {count === 1 ? "stock" : "stocks"}
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">Watchlist</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowSearch((v) => !v)}
            className="flex h-10 items-center rounded-[11px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)]"
          >
            + Add to Watchlist
          </button>
        </div>
      </div>

      {/* Add to Watchlist search */}
      {showSearch && (
        <div className="mb-[18px] rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <p className="mb-2.5 text-[11px] font-semibold tracking-[.03em] text-ink-3">
            ADD TO WATCHLIST
          </p>
          <StockSearch
            onSelect={(stock) => handleAdd(stock)}
            placeholder="Search and add stocks to watchlist…"
          />
        </div>
      )}

      {/* Table */}
      <section className="rounded-2xl border border-line bg-card pb-2 pt-[22px] shadow-card">
        <div className="grid grid-cols-[1.8fr_1.1fr_1fr_1.1fr_116px] gap-2 border-b border-line px-[22px] pb-2.5 text-[11px] font-semibold tracking-[.03em] text-ink-3">
          <span>SYMBOL</span>
          <span className="text-right">PRICE</span>
          <span className="text-right">CHANGE</span>
          <span className="text-right">VOLUME</span>
          <span className="text-right">ACTIONS</span>
        </div>

        {initialLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.8fr_1.1fr_1fr_1.1fr_116px] gap-2 border-b border-line-soft px-[22px] py-[11px]"
            >
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-4 animate-pulse rounded bg-line-soft" />
              ))}
            </div>
          ))
        ) : watchlist.length === 0 ? (
          <div className="py-16 text-center">
            <Star className="mx-auto mb-3 h-9 w-9 text-ink-3 opacity-50" />
            <p className="text-sm font-medium text-ink-2">Your watchlist is empty</p>
            <p className="mt-1 text-xs text-ink-3">
              Add stocks above to start tracking
            </p>
          </div>
        ) : (
          watchlist.map((item) => {
            const stock = marketData.get(item.symbol);
            const c = tint(item.symbol);
            const sUp = stock ? stock.change >= 0 : true;
            return (
              <div
                key={item.id}
                className="grid grid-cols-[1.8fr_1.1fr_1fr_1.1fr_116px] items-center gap-2 border-b border-line-soft px-[22px] py-[11px] hover:bg-ink/[.03]"
              >
                <Link
                  href={`/stock/${item.symbol}`}
                  className="flex min-w-0 items-center gap-2.5"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[10.56px] font-bold"
                    style={{ background: `${c}22`, color: c }}
                  >
                    {item.symbol.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{item.symbol}</div>
                    <div className="truncate text-[11px] text-ink-3">
                      {item.companyName}
                    </div>
                  </div>
                </Link>
                {stock ? (
                  <span className="num text-right text-[13px] font-semibold">
                    {formatPKR(stock.current, { decimals: 2 })}
                  </span>
                ) : (
                  <span className="text-right text-[11px] text-ink-3 animate-pulse">
                    …
                  </span>
                )}
                {stock ? (
                  <span
                    className="num text-right text-[12.5px] font-semibold"
                    style={{
                      color: sUp
                        ? "var(--color-gain)"
                        : "var(--color-loss-strong)",
                    }}
                  >
                    {sUp ? "+" : ""}
                    {stock.changePercent.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-right text-[12px] text-ink-3">—</span>
                )}
                <span className="num text-right text-[12px] text-ink-2">
                  {stock ? formatPKR(stock.volume, { compact: true }) : "—"}
                </span>
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => {
                      if (stock) setTradeStock(stock);
                    }}
                    disabled={!stock}
                    title="Trade"
                    className="h-[30px] rounded-lg border border-line px-3 text-[12px] font-semibold text-brand hover:bg-ink/[.04] disabled:opacity-40"
                  >
                    Trade
                  </button>
                  <button
                    onClick={() => handleRemove(item.symbol)}
                    title="Remove"
                    className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-line text-ink-3 hover:bg-loss-50 hover:text-loss-strong"
                  >
                    <X className="h-[14px] w-[14px]" />
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
