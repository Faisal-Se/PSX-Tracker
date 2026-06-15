"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
import { PageSkeleton } from "@/components/ui/skeleton";

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

interface ModelAllocation {
  symbol: string;
  companyName: string;
  percentage: number;
  shares: number;
  avgPrice: number;
}

interface ModelPortfolio {
  id: string;
  name: string;
  cashBalance: number;
  allocations: ModelAllocation[];
}

type Scope = "all" | "personal" | "models";

// Map a model portfolio into the page's Portfolio shape (excluding the CASH pseudo-row)
function modelToPortfolio(m: ModelPortfolio): Portfolio {
  return {
    id: m.id,
    name: m.name,
    cashBalance: m.cashBalance,
    holdings: m.allocations
      .filter((a) => a.symbol !== "CASH")
      .map((a) => ({
        id: `${m.id}-${a.symbol}`,
        symbol: a.symbol,
        companyName: a.companyName,
        quantity: a.shares,
        avgPrice: a.avgPrice,
      })),
  };
}

// Indigo-family chart palette (Linear aesthetic)
const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const chartTooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: "var(--popover-foreground)",
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipFormatPKR = (value: any) => [`PKR ${Number(value).toLocaleString()}`];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipFormatPnL = (value: any) => [`PKR ${Number(value).toLocaleString()}`, "P&L"];

export default function AnalyticsPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [modelPortfolios, setModelPortfolios] = useState<ModelPortfolio[]>([]);
  const [marketData, setMarketData] = useState<MarketStock[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [portfolioRes, modelRes, marketRes] = await Promise.all([
      fetch("/api/portfolios"),
      fetch("/api/model-portfolios"),
      fetch("/api/psx"),
    ]);

    if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
    if (modelRes.ok) {
      const data = await modelRes.json();
      setModelPortfolios(Array.isArray(data) ? data : []);
    }
    if (marketRes.ok) {
      const data = await marketRes.json();
      setMarketData(Array.isArray(data) ? data : []);
    }
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived portfolios based on the selected scope
  const activePortfolios = useMemo<Portfolio[]>(() => {
    const mapped = modelPortfolios.map(modelToPortfolio);
    if (scope === "personal") return portfolios;
    if (scope === "models") return mapped;
    return [...portfolios, ...mapped];
  }, [scope, portfolios, modelPortfolios]);

  const scopes: { value: Scope; label: string }[] = [
    { value: "all", label: "All" },
    { value: "personal", label: "Personal" },
    { value: "models", label: "Models" },
  ];

  const priceMap = new Map(marketData.map((s) => [s.symbol, s.current]));
  const sectorMap = new Map(marketData.map((s) => [s.symbol, s.sector]));

  const allHoldings = activePortfolios.flatMap((p) => p.holdings);

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
  const totalCash = activePortfolios.reduce((sum, p) => sum + p.cashBalance, 0);
  const totalPnL = totalCurrent - totalInvested;

  // Asset allocation (cash vs stocks)
  const assetAllocation = [
    { name: "Stocks", value: Math.round(totalCurrent) },
    { name: "Cash", value: Math.round(totalCash) },
  ];

  const hasData = allHoldings.length > 0;

  if (initialLoading) return <PageSkeleton />;

  const summaryStats = [
    {
      label: "Total Portfolio",
      icon: Wallet,
      value: `PKR ${formatPKR(totalCurrent + totalCash, { decimals: 0 })}`,
    },
    {
      label: "Invested",
      icon: Banknote,
      value: `PKR ${formatPKR(totalInvested, { decimals: 0 })}`,
    },
  ];

  return (
    <div className="space-y-6 lg:space-y-8 max-w-[1400px]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-in-up">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Portfolio
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
            Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Portfolio performance and allocation analysis
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border border-border p-0.5">
            {scopes.map((s) => (
              <button
                key={s.value}
                onClick={() => setScope(s.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  scope === s.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 rounded-lg"
            onClick={() => window.open("/api/export?type=portfolios&format=csv")}
          >
            <Download className="h-3 w-3" />
            Export Holdings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 rounded-lg"
            onClick={() => window.open("/api/export?type=model-portfolios&format=csv")}
          >
            <Download className="h-3 w-3" />
            Export Models
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 rounded-lg"
            onClick={() => window.open("/api/export?type=transactions&format=csv")}
          >
            <Download className="h-3 w-3" />
            Export Transactions
          </Button>
        </div>
      </div>

      {!hasData ? (
        <Card className="border border-border bg-card rounded-xl">
          <CardContent className="py-16 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-xl border border-border mb-4 mx-auto">
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
          {/* Summary Hero Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-xl border border-border bg-border animate-in-up-delay-1">
            {summaryStats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    <p className="text-[11px] font-semibold uppercase tracking-wide">
                      {s.label}
                    </p>
                  </div>
                  <p className="text-xl lg:text-2xl font-semibold font-tabular mt-2 leading-none">
                    {s.value}
                  </p>
                </div>
              );
            })}

            {/* Total P&L */}
            <div className="bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                {totalPnL >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <p className="text-[11px] font-semibold uppercase tracking-wide">
                  Total P&amp;L
                </p>
              </div>
              <p
                className="text-xl lg:text-2xl font-semibold font-tabular mt-2 leading-none"
                style={{ color: totalPnL >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
              >
                {totalPnL >= 0 ? "+" : ""}PKR{" "}
                {formatPKR(totalPnL, { decimals: 0 })}
              </p>
            </div>

            {/* Holdings count */}
            <div className="bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Layers className="h-4 w-4" />
                <p className="text-[11px] font-semibold uppercase tracking-wide">
                  Holdings
                </p>
              </div>
              <p className="text-xl lg:text-2xl font-semibold font-tabular mt-2 leading-none">
                {allHoldings.length}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  stocks
                </span>
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in-up-delay-2">
            {/* Asset Allocation */}
            <Card className="border border-border bg-card rounded-xl">
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
                      contentStyle={chartTooltipStyle}
                    />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2">
                  {assetAllocation.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
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
            <Card className="border border-border bg-card rounded-xl">
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
                      contentStyle={chartTooltipStyle}
                    />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                  {sectorData.slice(0, 8).map((item, i) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-xs">{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* P&L Per Stock */}
          <Card className="border border-border bg-card rounded-xl animate-in-up-delay-3">
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
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="symbol"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatPKR(v, { compact: true, decimals: 0 })}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    cursor={{ fill: "var(--border)", opacity: 0.3 }}
                    formatter={tooltipFormatPnL}
                  />
                  <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                    {pnlData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Holdings Breakdown Table */}
          <Card className="border border-border bg-card rounded-xl animate-in-up-delay-4">
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
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="text-right py-3 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Value
                      </th>
                      <th className="text-right py-3 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Weight
                      </th>
                      <th className="text-right py-3 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        P&L
                      </th>
                      <th className="text-right py-3 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                          className="table-row-hover border-b border-border last:border-0"
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
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${Math.min(weight, 100)}%` }}
                                />
                              </div>
                              <span className="font-tabular text-xs min-w-[40px] text-right">
                                {weight.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td
                            className="text-right py-3 px-2 font-tabular font-semibold"
                            style={{ color: item.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
                          >
                            {item.pnl >= 0 ? "+" : ""}
                            {item.pnl.toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-2">
                            <span
                              className="inline-block text-[11px] font-semibold font-tabular px-1.5 py-0.5 rounded-md"
                              style={{
                                color: item.pnlPercent >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                                background: item.pnlPercent >= 0 ? "var(--color-profit-bg)" : "var(--color-loss-bg)",
                              }}
                            >
                              {item.pnlPercent >= 0 ? "+" : ""}
                              {item.pnlPercent.toFixed(2)}%
                            </span>
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
