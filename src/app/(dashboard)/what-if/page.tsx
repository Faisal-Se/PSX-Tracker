"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calculator,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Trash2,
  PieChart,
} from "lucide-react";
import { formatPKR } from "@/lib/market-status";

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
      const pnlPct =
        actualInvested > 0 ? (pnl / actualInvested) * 100 : 0;
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

  const totalInvested = simResults.reduce(
    (sum, s) => sum + s.actualInvested,
    0
  );
  const totalTargetValue = simResults.reduce(
    (sum, s) => sum + s.targetValue,
    0
  );
  const totalSimPnL = totalTargetValue - totalInvested;
  const totalSimPnLPct =
    totalInvested > 0 ? (totalSimPnL / totalInvested) * 100 : 0;

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
    <div className="space-y-6 lg:space-y-8 max-w-[1200px]">
      {/* Header */}
      <div className="animate-in-up flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card">
          <Calculator className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
            What-If Calculator
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Simulate investments and see potential returns before committing
          </p>
        </div>
      </div>

      {/* Scenario Inputs */}
      <Card className="rounded-xl border border-border bg-card animate-in-up-delay-1">
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-5 pb-5">
          <div className="lg:col-span-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Investment Budget
            </Label>
            <Input
              type="number"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              className="mt-2 rounded-lg border border-border bg-card font-tabular text-lg h-12 focus-visible:ring-ring"
              placeholder="100000"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Total amount you want to simulate investing
            </p>
          </div>

          <div className="lg:col-span-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Add Stocks to Simulate
            </Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PSX stocks..."
                className="pl-9 rounded-lg border border-border bg-card h-12 focus-visible:ring-ring"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                {searchResults.map((stock) => (
                  <button
                    key={stock.symbol}
                    onClick={() => addStock(stock)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-sm group-hover:text-primary">
                        {stock.symbol}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-2 truncate">
                        {stock.company}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-tabular text-muted-foreground">
                        PKR {formatPKR(stock.current)}
                      </span>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchLoading && searchQuery.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">Searching...</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Simulation Table */}
      {stocks.length > 0 && (
        <Card className="rounded-xl border border-border bg-card animate-in-up-delay-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-muted-foreground" />
              Simulation ({stocks.length} stock{stocks.length !== 1 ? "s" : ""})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-2 font-semibold">Stock</th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Current
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Invest (PKR)
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Shares
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Target Price
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">P&L</th>
                    <th className="text-center py-2 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {simResults.map((s) => (
                    <tr
                      key={s.symbol}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-2">
                        <p className="font-semibold">{s.symbol}</p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                          {s.companyName}
                        </p>
                      </td>
                      <td className="text-right py-3 px-2 font-tabular text-muted-foreground">
                        {formatPKR(s.currentPrice)}
                      </td>
                      <td className="text-right py-3 px-2">
                        <Input
                          type="number"
                          value={s.investAmount}
                          onChange={(e) =>
                            updateStock(
                              s.symbol,
                              "investAmount",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24 h-7 rounded-lg border border-border bg-card text-right font-tabular text-xs ml-auto focus-visible:ring-ring"
                        />
                      </td>
                      <td className="text-right py-3 px-2 font-tabular font-semibold">
                        {s.shares}
                      </td>
                      <td className="text-right py-3 px-2">
                        <Input
                          type="number"
                          value={s.targetPrice}
                          onChange={(e) =>
                            updateStock(
                              s.symbol,
                              "targetPrice",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24 h-7 rounded-lg border border-border bg-card text-right font-tabular text-xs ml-auto focus-visible:ring-ring"
                        />
                      </td>
                      <td className="text-right py-3 px-2">
                        <div
                          className="font-tabular font-semibold"
                          style={{
                            color:
                              s.pnl >= 0
                                ? "var(--color-profit)"
                                : "var(--color-loss)",
                          }}
                        >
                          <span className="flex items-center justify-end gap-0.5">
                            {s.pnl >= 0 ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {formatPKR(Math.abs(s.pnl), { decimals: 0 })}
                          </span>
                          <span className="text-[11px] opacity-80">
                            {s.pnlPct >= 0 ? "+" : ""}
                            {s.pnlPct.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">
                        <button
                          onClick={() => removeStock(s.symbol)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary metric cells */}
            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-lg border border-border overflow-hidden bg-border">
              <div className="bg-card p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">
                  Total Invested
                </p>
                <p className="text-lg font-semibold font-tabular mt-1">
                  PKR {formatPKR(totalInvested, { decimals: 0 })}
                </p>
              </div>
              <div className="bg-card p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">
                  Target Value
                </p>
                <p className="text-lg font-semibold font-tabular mt-1">
                  PKR {formatPKR(totalTargetValue, { decimals: 0 })}
                </p>
              </div>
              <div className="bg-card p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">
                  Simulated P&L
                </p>
                <p
                  className="text-lg font-semibold font-tabular mt-1"
                  style={{
                    color:
                      totalSimPnL >= 0
                        ? "var(--color-profit)"
                        : "var(--color-loss)",
                  }}
                >
                  {totalSimPnL >= 0 ? "+" : ""}
                  {formatPKR(totalSimPnL, { decimals: 0 })} (
                  {totalSimPnLPct >= 0 ? "+" : ""}
                  {totalSimPnLPct.toFixed(2)}%)
                </p>
              </div>
              <div className="bg-card p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">
                  Portfolio Impact
                </p>
                <p className="text-lg font-semibold font-tabular mt-1">
                  PKR {formatPKR(currentPortfolioValue, { decimals: 0 })} &rarr;{" "}
                  <span
                    style={{
                      color:
                        newPortfolioValue >= currentPortfolioValue
                          ? "var(--color-profit)"
                          : "var(--color-loss)",
                    }}
                  >
                    {formatPKR(newPortfolioValue, { decimals: 0 })}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {stocks.length === 0 && (
        <Card className="rounded-xl border border-border bg-card animate-in-up-delay-2">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-lg border border-border bg-card flex items-center justify-center mx-auto mb-4">
              <Calculator className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">Start a Simulation</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Search and add stocks above to simulate potential investments.
              Adjust invest amounts and target prices to see projected returns.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
