"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Plus, X } from "lucide-react";
import { formatPKR } from "@/lib/market-status";

const TINTS = ["#2563EB", "#7C3AED", "#0D9488", "#DB2777", "#CA8A04", "#0891B2", "#16A34A", "#4F46E5"];
function tint(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

interface SearchStock {
  symbol: string;
  company: string;
  current: number;
}

interface SimStock {
  symbol: string;
  companyName: string;
  currentPrice: number;
  investAmount: number;
  targetPrice: number;
}

interface Holding {
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
}

export default function WhatIfPage() {
  const [stocks, setStocks] = useState<SimStock[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStock[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [totalBudget, setTotalBudget] = useState("100000");
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [marketData, setMarketData] = useState<MarketStock[]>([]);

  const fetchData = useCallback(async () => {
    const [portfolioRes, marketRes] = await Promise.all([
      fetch("/api/portfolios"),
      fetch("/api/psx"),
    ]);
    if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
    if (marketRes.ok) {
      const data = await marketRes.json();
      setMarketData(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const priceMap = useMemo(
    () => new Map(marketData.map((s) => [s.symbol, s.current])),
    [marketData]
  );

  // Debounced stock search
  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/psx?action=search&q=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          const existing = new Set(stocks.map((s) => s.symbol));
          setSearchResults(
            data
              .filter((s: SearchStock) => !existing.has(s.symbol))
              .slice(0, 6)
          );
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, stocks]);

  const addStock = (stock: SearchStock) => {
    const budget = parseFloat(totalBudget) || 100000;
    const perStock = budget / (stocks.length + 1);

    setStocks((prev) => [
      ...prev,
      {
        symbol: stock.symbol,
        companyName: stock.company,
        currentPrice: stock.current,
        investAmount: Math.round(perStock),
        targetPrice: stock.current * 1.1, // default 10% gain
      },
    ]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeStock = (symbol: string) => {
    setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
  };

  const updateStock = (
    symbol: string,
    field: "investAmount" | "targetPrice",
    value: number
  ) => {
    setStocks((prev) =>
      prev.map((s) => (s.symbol === symbol ? { ...s, [field]: value } : s))
    );
  };

  // Calculate simulation results
  const simResults = useMemo(() => {
    return stocks.map((s) => {
      const shares = Math.floor(s.investAmount / s.currentPrice);
      const actualInvested = shares * s.currentPrice;
      const targetValue = shares * s.targetPrice;
      const pnl = targetValue - actualInvested;
      const pnlPct = actualInvested > 0 ? (pnl / actualInvested) * 100 : 0;
      return {
        ...s,
        shares,
        actualInvested,
        targetValue,
        pnl,
        pnlPct,
      };
    });
  }, [stocks]);

  const totalInvested = simResults.reduce((sum, s) => sum + s.actualInvested, 0);
  const totalTargetValue = simResults.reduce((sum, s) => sum + s.targetValue, 0);
  const totalSimPnL = totalTargetValue - totalInvested;
  const totalSimPnLPct =
    totalInvested > 0 ? (totalSimPnL / totalInvested) * 100 : 0;

  const budget = parseFloat(totalBudget) || 0;
  const budgetUsedPct = budget > 0 ? Math.round((totalInvested / budget) * 100) : 0;

  // Current portfolio impact
  const currentPortfolioValue = portfolios.reduce(
    (sum, p) =>
      sum +
      p.cashBalance +
      p.holdings.reduce((hSum, h) => {
        const cp = priceMap.get(h.symbol) || h.avgPrice;
        return hSum + cp * h.quantity;
      }, 0),
    0
  );

  const newPortfolioValue = currentPortfolioValue + totalSimPnL;

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            Model hypothetical investments and outcomes
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">
            What-If Simulator
          </h1>
        </div>
      </div>

      {/* Investment Budget */}
      <section className="mb-[18px] rounded-2xl border border-line bg-card p-[22px] shadow-card">
        <div className="mb-2 text-[12.5px] font-medium text-ink-2">
          Investment Budget
        </div>
        <div className="num flex items-center gap-2 text-[30px] font-bold">
          <span className="text-ink-3">Rs</span>
          <input
            type="number"
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value)}
            className="w-full bg-transparent outline-none"
          />
        </div>
      </section>

      {/* Summary cards */}
      <div className="mb-[18px] grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">
            Total Invested
          </div>
          <div className="num text-[22px] font-bold tracking-[-.025em]">
            Rs {formatPKR(totalInvested, { decimals: 0 })}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">
            Target Value
          </div>
          <div className="num text-[22px] font-bold tracking-[-.025em]">
            Rs {formatPKR(totalTargetValue, { decimals: 0 })}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">
            Simulated P&amp;L
          </div>
          <div
            className="num text-[22px] font-bold tracking-[-.025em]"
            style={{
              color:
                totalSimPnL >= 0
                  ? "var(--color-gain)"
                  : "var(--color-loss-strong)",
            }}
          >
            {totalSimPnL >= 0 ? "+" : "-"}Rs{" "}
            {formatPKR(Math.abs(totalSimPnL), { decimals: 0 })}
          </div>
          <div
            className="num mt-1 text-[12px]"
            style={{
              color:
                totalSimPnL >= 0
                  ? "var(--color-gain)"
                  : "var(--color-loss-strong)",
            }}
          >
            {totalSimPnLPct >= 0 ? "+" : ""}
            {totalSimPnLPct.toFixed(2)}%
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">
            Portfolio Impact
          </div>
          <div className="num text-[22px] font-bold tracking-[-.025em]">
            {budgetUsedPct}%
          </div>
          <div className="num mt-1 text-[12px] text-ink-3">
            Rs {formatPKR(currentPortfolioValue, { decimals: 0 })} &rarr;{" "}
            <span
              style={{
                color:
                  newPortfolioValue >= currentPortfolioValue
                    ? "var(--color-gain)"
                    : "var(--color-loss-strong)",
              }}
            >
              Rs {formatPKR(newPortfolioValue, { decimals: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Simulation */}
      <section className="rounded-2xl border border-line bg-card pb-2 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] pb-3.5 pt-[22px]">
          <h2 className="text-[16px] font-bold">Simulation</h2>
          <label className="relative flex min-w-[220px] items-center">
            <Search className="absolute left-3 h-[15px] w-[15px] opacity-50" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PSX stocks…"
              className="h-[38px] w-full rounded-[10px] border border-line bg-canvas pl-8 pr-3 text-[13px] outline-none focus:border-brand"
            />
            {(searchResults.length > 0 ||
              (searchLoading && searchQuery.length > 0)) && (
              <div className="absolute left-0 right-0 top-[44px] z-20 overflow-hidden rounded-[12px] border border-line bg-card shadow-pop">
                {searchLoading && searchResults.length === 0 ? (
                  <div className="px-3.5 py-3 text-[12px] text-ink-3">
                    Searching…
                  </div>
                ) : (
                  searchResults.map((stock) => {
                    const c = tint(stock.symbol);
                    return (
                      <button
                        key={stock.symbol}
                        onClick={() => addStock(stock)}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-ink/[.04]"
                      >
                        <span
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[9.5px] font-bold"
                          style={{ background: `${c}22`, color: c }}
                        >
                          {stock.symbol.slice(0, 2)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold">
                            {stock.symbol}
                          </div>
                          <div className="truncate text-[11px] text-ink-3">
                            {stock.company}
                          </div>
                        </div>
                        <span className="num shrink-0 text-[12px] text-ink-2">
                          Rs {formatPKR(stock.current, { decimals: 1 })}
                        </span>
                        <Plus className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </label>
        </div>

        {stocks.length === 0 ? (
          <div className="px-[22px] py-16 text-center">
            <Search className="mx-auto mb-3 h-9 w-9 text-ink-3 opacity-50" />
            <p className="text-sm font-medium text-ink-2">Start a simulation</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-3">
              Search and add stocks above to simulate potential investments.
              Adjust invest amounts and target prices to see projected returns.
            </p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[1.5fr_1fr_1.1fr_.9fr_1fr_1fr_40px] gap-2.5 border-b border-line px-[22px] pb-2.5 text-[11px] font-semibold tracking-[.03em] text-ink-3">
              <span>STOCK</span>
              <span className="text-right">PRICE</span>
              <span className="text-right">INVEST</span>
              <span className="text-right">SHARES</span>
              <span className="text-right">TARGET</span>
              <span className="text-right">P&amp;L</span>
              <span></span>
            </div>

            {simResults.map((s) => {
              const c = tint(s.symbol);
              const up = s.pnl >= 0;
              return (
                <div
                  key={s.symbol}
                  className="grid grid-cols-[1.5fr_1fr_1.1fr_.9fr_1fr_1fr_40px] items-center gap-2.5 border-b border-line-soft px-[22px] py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] text-[9.9px] font-bold"
                      style={{ background: `${c}22`, color: c }}
                    >
                      {s.symbol.slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold">
                        {s.symbol}
                      </div>
                      <div className="truncate text-[11px] text-ink-3">
                        {s.companyName}
                      </div>
                    </div>
                  </div>
                  <span className="num text-right text-[12.5px] text-ink-2">
                    {formatPKR(s.currentPrice, { decimals: 1 })}
                  </span>
                  <input
                    type="number"
                    value={s.investAmount}
                    onChange={(e) =>
                      updateStock(
                        s.symbol,
                        "investAmount",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="num h-[34px] w-full rounded-lg border border-line bg-canvas px-2.5 text-right text-[13px] font-semibold outline-none focus:border-brand"
                  />
                  <span className="num text-right text-[12.5px] font-semibold">
                    {s.shares}
                  </span>
                  <input
                    type="number"
                    value={s.targetPrice}
                    onChange={(e) =>
                      updateStock(
                        s.symbol,
                        "targetPrice",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="num h-[34px] w-full rounded-lg border border-line bg-canvas px-2.5 text-right text-[13px] font-semibold outline-none focus:border-brand"
                  />
                  <span
                    className="num text-right text-[12.5px] font-semibold"
                    style={{
                      color: up
                        ? "var(--color-gain)"
                        : "var(--color-loss-strong)",
                    }}
                  >
                    {up ? "+" : "-"}
                    {formatPKR(Math.abs(s.pnl), { decimals: 0 })}
                  </span>
                  <button
                    onClick={() => removeStock(s.symbol)}
                    title="Remove"
                    className="grid h-7 w-7 place-items-center justify-self-end rounded-lg text-ink-3 hover:bg-ink/[.04]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </section>
    </>
  );
}
