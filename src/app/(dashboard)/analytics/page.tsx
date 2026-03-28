"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  PieChart,
  Wallet,
  Banknote,
  Layers,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import Link from "next/link";
import { formatPKR } from "@/lib/market-status";

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
  sector: string;
  current: number;
}

const COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipFormatPKR = (value: any) => [`PKR ${Number(value).toLocaleString()}`];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipFormatPnL = (value: any) => [`PKR ${Number(value).toLocaleString()}`, "P&L"];

export default function AnalyticsPage() {
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

  const priceMap = new Map(marketData.map((s) => [s.symbol, s.current]));
  const sectorMap = new Map(marketData.map((s) => [s.symbol, s.sector]));

  const allHoldings = portfolios.flatMap((p) => p.holdings);

  // Holdings allocation by value
  const holdingValues = allHoldings.map((h) => {
    const currentPrice = priceMap.get(h.symbol) || h.avgPrice;
    return {
      name: h.symbol,
      value: Math.round(currentPrice * h.quantity),
    };
  });

  // Sector allocation
  const sectorAllocation = new Map<string, number>();
  allHoldings.forEach((h) => {
    const currentPrice = priceMap.get(h.symbol) || h.avgPrice;
    const value = currentPrice * h.quantity;
    const sector = sectorMap.get(h.symbol) || "Other";
    sectorAllocation.set(
      sector,
      (sectorAllocation.get(sector) || 0) + value
    );
  });
  const sectorData = Array.from(sectorAllocation.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  // P&L per stock
  const pnlData = allHoldings
    .map((h) => {
      const currentPrice = priceMap.get(h.symbol) || h.avgPrice;
      const pnl = (currentPrice - h.avgPrice) * h.quantity;
      return {
        symbol: h.symbol,
        pnl: Math.round(pnl),
        pnlPercent:
          h.avgPrice > 0
            ? ((currentPrice - h.avgPrice) / h.avgPrice) * 100
            : 0,
      };
    })
    .sort((a, b) => b.pnl - a.pnl);

  // Portfolio totals
  const totalInvested = allHoldings.reduce(
    (sum, h) => sum + h.avgPrice * h.quantity,
    0
  );
  const totalCurrent = allHoldings.reduce((sum, h) => {
    const price = priceMap.get(h.symbol) || h.avgPrice;
    return sum + price * h.quantity;
  }, 0);
  const totalCash = portfolios.reduce((sum, p) => sum + p.cashBalance, 0);
  const totalPnL = totalCurrent - totalInvested;

  // Asset allocation (cash vs stocks)
  const assetAllocation = [
    { name: "Stocks", value: Math.round(totalCurrent) },
    { name: "Cash", value: Math.round(totalCash) },
  ];

  const hasData = allHoldings.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-violet-500/10">
              <BarChart3 className="h-5 w-5 text-violet-500" />
            </div>
            Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Portfolio performance and allocation analysis
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 rounded-xl"
            onClick={() => window.open("/api/export?type=portfolios&format=csv")}
          >
            <Download className="h-3 w-3" />
            Export Holdings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 rounded-xl"
            onClick={() => window.open("/api/export?type=model-portfolios&format=csv")}
          >
            <Download className="h-3 w-3" />
            Export Models
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 rounded-xl"
            onClick={() => window.open("/api/export?type=transactions&format=csv")}
          >
            <Download className="h-3 w-3" />
            Export Transactions
          </Button>
        </div>
      </div>

      {!hasData ? (
        <Card className="rounded-xl shadow-sm border-border/50">
          <CardContent className="py-16 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted/50 mb-4 mx-auto">
              <BarChart3 className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No holdings data to analyze yet
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Start trading from the Market page to see analytics here
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="stat-card rounded-xl shadow-sm border-border/50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10">
                    <Wallet className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Total Portfolio
                    </p>
                    <p className="text-xl font-bold font-tabular mt-0.5">
                      PKR {formatPKR(totalCurrent + totalCash, { decimals: 0 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="stat-card rounded-xl shadow-sm border-border/50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/10">
                    <Banknote className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Invested
                    </p>
                    <p className="text-xl font-bold font-tabular mt-0.5">
                      PKR {formatPKR(totalInvested, { decimals: 0 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="stat-card rounded-xl shadow-sm border-border/50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center justify-center h-10 w-10 rounded-xl ${
                      totalPnL >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
                    }`}
                  >
                    {totalPnL >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Total P&L
                    </p>
                    <p
                      className={`text-xl font-bold font-tabular mt-0.5 ${
                        totalPnL >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {totalPnL >= 0 ? "+" : ""}PKR{" "}
                      {formatPKR(totalPnL, { decimals: 0 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="stat-card rounded-xl shadow-sm border-border/50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-violet-500/10">
                    <Layers className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Holdings
                    </p>
                    <p className="text-xl font-bold font-tabular mt-0.5">
                      {allHoldings.length}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        stocks
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Asset Allocation */}
            <Card className="rounded-xl shadow-sm border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Asset Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RePieChart>
                    <Pie
                      data={assetAllocation}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {assetAllocation.map((_, index) => (
                        <Cell
                          key={index}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={tooltipFormatPKR}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2">
                  {assetAllocation.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: COLORS[i] }}
                      />
                      <span className="text-sm font-tabular">
                        {item.name}: PKR {item.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sector Allocation */}
            <Card className="rounded-xl shadow-sm border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Sector Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RePieChart>
                    <Pie
                      data={sectorData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {sectorData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={tooltipFormatPKR}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                  {sectorData.slice(0, 8).map((item, i) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[i] }}
                      />
                      <span className="text-xs">{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* P&L Per Stock */}
          <Card className="rounded-xl shadow-sm border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Profit & Loss by Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={pnlData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    strokeOpacity={0.5}
                  />
                  <XAxis
                    dataKey="symbol"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatPKR(v, { compact: true, decimals: 0 })}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                    formatter={tooltipFormatPnL}
                  />
                  <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                    {pnlData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.pnl >= 0 ? "#10b981" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Holdings Breakdown Table */}
          <Card className="rounded-xl shadow-sm border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Holdings Breakdown
                </CardTitle>
                <Badge variant="secondary" className="text-xs font-tabular">
                  {pnlData.length} holdings
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Value
                      </th>
                      <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Weight
                      </th>
                      <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        P&L
                      </th>
                      <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        P&L %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnlData.map((item) => {
                      const holding = allHoldings.find(
                        (h) => h.symbol === item.symbol
                      )!;
                      const currentPrice =
                        priceMap.get(item.symbol) || holding.avgPrice;
                      const value = currentPrice * holding.quantity;
                      const weight =
                        totalCurrent > 0 ? (value / totalCurrent) * 100 : 0;

                      return (
                        <tr
                          key={item.symbol}
                          className="table-row-hover border-b border-border/30 last:border-0"
                        >
                          <td className="py-3 px-2">
                            <Link
                              href={`/stock/${item.symbol}`}
                              className="hover:text-primary transition-colors"
                            >
                              <span className="font-semibold">
                                {item.symbol}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {holding.companyName}
                              </span>
                            </Link>
                          </td>
                          <td className="text-right py-3 px-2 font-tabular font-medium">
                            PKR{" "}
                            {formatPKR(value, { decimals: 0 })}
                          </td>
                          <td className="text-right py-3 px-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary/60"
                                  style={{ width: `${Math.min(weight, 100)}%` }}
                                />
                              </div>
                              <span className="font-tabular text-xs min-w-[40px] text-right">
                                {weight.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td
                            className={`text-right py-3 px-2 font-tabular font-semibold ${
                              item.pnl >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {item.pnl >= 0 ? "+" : ""}
                            {item.pnl.toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-2">
                            <Badge
                              variant="secondary"
                              className={`text-[11px] font-semibold font-tabular px-1.5 py-0.5 rounded-md ${
                                item.pnlPercent >= 0
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-red-500/10 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {item.pnlPercent >= 0 ? "+" : ""}
                              {item.pnlPercent.toFixed(2)}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
