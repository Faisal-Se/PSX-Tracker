"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatPKR } from "@/lib/market-status";

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

export default function DashboardPage() {
  const [kse100, setKse100] = useState<KSE100 | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [marketData, setMarketData] = useState<MarketStock[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [kseRes, portfolioRes, marketRes] = await Promise.all([
        fetch("/api/psx?action=kse100"),
        fetch("/api/portfolios"),
        fetch("/api/psx"),
      ]);

      if (kseRes.ok) setKse100(await kseRes.json());
      if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
      if (marketRes.ok) {
        const data = await marketRes.json();
        setMarketData(Array.isArray(data) ? data : []);
      }
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

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-end justify-between animate-in-up">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your portfolio overview and market summary
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={refreshing}
          className="h-8 text-xs gap-1.5 rounded-xl"
        >
          <RefreshCw
            className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* KSE-100 Hero Card */}
      <div className="relative rounded-2xl overflow-hidden border-0 shadow-lg shadow-emerald-500/10 hero-card animate-in-up-delay-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZyIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMC41IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2cpIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIvPjwvc3ZnPg==')] opacity-50" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400/80">
                KSE 100 Index
              </span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
            </div>
            <p className="text-5xl font-bold font-tabular tracking-tight">
              {kse100?.current ? formatPKR(kse100.current) : "—"}
            </p>
            {kse100 && (
              <div
                className={`flex items-center gap-2 mt-3 text-sm font-semibold ${
                  kse100.change >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {kse100.change >= 0 ? (
                  <ArrowUpRight className="h-5 w-5" />
                ) : (
                  <ArrowDownRight className="h-5 w-5" />
                )}
                <span className="font-tabular text-lg">
                  {kse100.change >= 0 ? "+" : ""}
                  {formatPKR(Math.abs(kse100.change))}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                    kse100.change >= 0
                      ? "bg-emerald-400/20 text-emerald-300"
                      : "bg-red-400/20 text-red-300"
                  }`}
                >
                  {kse100.changePercent >= 0 ? "+" : ""}
                  {kse100.changePercent.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          {kse100 && (
            <div className="text-right space-y-3">
              <div className="text-sm">
                <span className="text-white/40 font-medium">High</span>{" "}
                <span className="font-tabular text-white/90 font-semibold">
                  {formatPKR(kse100.high)}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-white/40 font-medium">Low</span>{" "}
                <span className="font-tabular text-white/90 font-semibold">
                  {formatPKR(kse100.low)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in-up-delay-2">
        <Card className="stat-card stat-card-emerald border-border/50 shadow-sm rounded-2xl">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Portfolio Value
                </p>
                <p className="text-2xl font-bold font-tabular mt-1.5">
                  {formatPKR(totalCurrentValue, { decimals: 0 })}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl icon-bg-emerald flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Across {portfolios.length} portfolio{portfolios.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card stat-card-blue border-border/50 shadow-sm rounded-2xl">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Cash Balance
                </p>
                <p className="text-2xl font-bold font-tabular mt-1.5">
                  {formatPKR(totalCash, { decimals: 0 })}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl icon-bg-blue flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Available for trading
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card stat-card-violet border-border/50 shadow-sm rounded-2xl">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total Invested
                </p>
                <p className="text-2xl font-bold font-tabular mt-1.5">
                  {formatPKR(totalInvested, { decimals: 0 })}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl icon-bg-violet flex items-center justify-center">
                <Banknote className="h-5 w-5 text-violet-500" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Cost basis
            </p>
          </CardContent>
        </Card>

        <Card className={`stat-card ${totalPnL >= 0 ? "stat-card-emerald" : "stat-card-rose"} border-border/50 shadow-sm rounded-2xl`}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total P&L
                </p>
                <p
                  className={`text-2xl font-bold font-tabular mt-1.5 ${
                    totalPnL >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {totalPnL >= 0 ? "+" : ""}
                  {formatPKR(totalPnL, { decimals: 0 })}
                </p>
              </div>
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  totalPnL >= 0 ? "icon-bg-emerald" : "icon-bg-rose"
                }`}
              >
                {totalPnL >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>
            <p
              className={`text-[11px] font-semibold mt-2 ${
                totalPnLPercent >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {totalPnLPercent >= 0 ? "+" : ""}
              {totalPnLPercent.toFixed(2)}% return
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Holdings & Market Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-in-up-delay-3">
        {/* My Holdings - Wider */}
        <Card className="lg:col-span-3 border-border/50 shadow-sm rounded-2xl">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-md icon-bg-violet flex items-center justify-center">
                  <PieChart className="h-3.5 w-3.5 text-violet-500" />
                </div>
                My Holdings
              </CardTitle>
              <Link href="/portfolio">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-muted-foreground hover:text-foreground"
                >
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {portfolios.flatMap((p) => p.holdings).length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Briefcase className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  No holdings yet
                </p>
                <Link href="/market">
                  <Button variant="link" size="sm" className="mt-1 text-xs">
                    Browse market to buy stocks
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-0.5">
                {portfolios
                  .flatMap((p) =>
                    p.holdings.map((h) => ({ ...h, portfolioName: p.name }))
                  )
                  .slice(0, 8)
                  .map((h) => {
                    const currentPrice = priceMap.get(h.symbol) || h.avgPrice;
                    const pnl = (currentPrice - h.avgPrice) * h.quantity;
                    const pnlPercent =
                      h.avgPrice > 0
                        ? ((currentPrice - h.avgPrice) / h.avgPrice) * 100
                        : 0;

                    return (
                      <Link
                        key={h.id}
                        href={`/stock/${h.symbol}`}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/60 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 flex items-center justify-center text-xs font-bold text-emerald-600 group-hover:from-emerald-500/20 group-hover:to-cyan-500/20 transition-all">
                            {h.symbol.slice(0, 3)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{h.symbol}</p>
                            <p className="text-[11px] text-muted-foreground font-tabular">
                              {h.quantity} shares @ {h.avgPrice.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold font-tabular">
                            {formatPKR(currentPrice * h.quantity, {
                              decimals: 0,
                            })}
                          </p>
                          <p
                            className={`text-[11px] font-semibold font-tabular ${
                              pnl >= 0 ? "text-emerald-600" : "text-red-500"
                            }`}
                          >
                            {pnl >= 0 ? "+" : ""}
                            {formatPKR(pnl, { decimals: 0 })} (
                            {pnlPercent >= 0 ? "+" : ""}
                            {pnlPercent.toFixed(1)}%)
                          </p>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Market Movers */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-emerald-500/20 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-1 bg-gradient-to-r from-emerald-500/5 to-transparent">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-emerald-500/15 flex items-center justify-center">
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <span className="text-emerald-700 dark:text-emerald-400">Top Gainers</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0.5">
                {topGainers.map((s, i) => (
                  <Link
                    key={s.symbol}
                    href={`/stock/${s.symbol}`}
                    className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-emerald-500/5 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold text-muted-foreground/50 w-4">{i + 1}</span>
                      <span className="text-sm font-semibold group-hover:text-emerald-600 transition-colors">{s.symbol}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-tabular font-medium">
                        {s.current.toFixed(2)}
                      </span>
                      <span className="text-[11px] font-bold font-tabular px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 min-w-[56px] text-center">
                        +{s.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </Link>
                ))}
                {topGainers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Loading...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-1 bg-gradient-to-r from-red-500/5 to-transparent">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-red-500/15 flex items-center justify-center">
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                </div>
                <span className="text-red-700 dark:text-red-400">Top Losers</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0.5">
                {topLosers.map((s, i) => (
                  <Link
                    key={s.symbol}
                    href={`/stock/${s.symbol}`}
                    className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-red-500/5 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold text-muted-foreground/50 w-4">{i + 1}</span>
                      <span className="text-sm font-semibold group-hover:text-red-500 transition-colors">{s.symbol}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-tabular font-medium">
                        {s.current.toFixed(2)}
                      </span>
                      <span className="text-[11px] font-bold font-tabular px-2 py-0.5 rounded-md bg-red-500/15 text-red-500 min-w-[56px] text-center">
                        {s.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </Link>
                ))}
                {topLosers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Loading...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
