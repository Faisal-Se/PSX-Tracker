"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  BarChart3,
  PieChart,
  Plus,
  X,
  Search,
  RefreshCw,
  DollarSign,
  Pencil,
  Minus,
  ShoppingCart,
  Trash2,
  Activity,
} from "lucide-react";
import { formatPKR } from "@/lib/market-status";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart as RechartsPie,
  Pie,
} from "recharts";

interface Allocation {
  id: string;
  symbol: string;
  companyName: string;
  percentage: number;
  shares: number;
  avgPrice: number;
}

interface ModelTransaction {
  id: string;
  type: string;
  symbol: string;
  companyName: string;
  quantity: number;
  price: number;
  total: number;
  createdAt: string;
}

interface ModelPortfolio {
  id: string;
  name: string;
  description: string;
  cashBalance: number;
  allocations: Allocation[];
  transactions: ModelTransaction[];
}

interface SearchStock {
  symbol: string;
  company: string;
  current: number;
}

export default function ModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [model, setModel] = useState<ModelPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});

  // Add cash dialog
  const [showAddCash, setShowAddCash] = useState(false);
  const [addCashAmount, setAddCashAmount] = useState("");
  const [addCashLoading, setAddCashLoading] = useState(false);

  // Withdraw cash dialog
  const [showWithdrawCash, setShowWithdrawCash] = useState(false);
  const [withdrawCashAmount, setWithdrawCashAmount] = useState("");
  const [withdrawCashLoading, setWithdrawCashLoading] = useState(false);

  // Edit info dialog
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Rebalance mode
  const [showRebalance, setShowRebalance] = useState(false);
  const [rebalanceAllocations, setRebalanceAllocations] = useState<
    { symbol: string; companyName: string; percentage: number }[]
  >([]);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [rebalanceError, setRebalanceError] = useState("");
  const [rebalanceSellPrices, setRebalanceSellPrices] = useState<
    Record<string, string>
  >({});

  // Bulk trade
  const [showBulkTrade, setShowBulkTrade] = useState(false);
  const [bulkTrades, setBulkTrades] = useState<
    { symbol: string; companyName: string; type: "BUY" | "SELL"; quantity: string }[]
  >([]);
  const [bulkTradeLoading, setBulkTradeLoading] = useState(false);
  const [bulkTradeError, setBulkTradeError] = useState("");

  // Stock search (shared for rebalance and bulk trade)
  const [stockQuery, setStockQuery] = useState("");
  const [stockResults, setStockResults] = useState<SearchStock[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [modelRes, marketRes] = await Promise.all([
        fetch(`/api/model-portfolios/${id}`),
        fetch("/api/psx?action=market"),
      ]);

      if (modelRes.ok) {
        setModel(await modelRes.json());
      }

      if (marketRes.ok) {
        const data = await marketRes.json();
        const prices: Record<string, number> = {};
        for (const s of data) {
          prices[s.symbol] = s.current;
        }
        setMarketPrices(prices);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced stock search for rebalance
  useEffect(() => {
    if (stockQuery.length < 1) {
      setStockResults([]);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/psx?action=search&q=${encodeURIComponent(stockQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          const existing = new Set(rebalanceAllocations.map((a) => a.symbol));
          setStockResults(
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
  }, [stockQuery, rebalanceAllocations]);

  if (loading || !model) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate portfolio metrics
  const stockAllocations = model.allocations.filter(
    (a) => a.symbol !== "CASH"
  );
  const investedValue = stockAllocations.reduce(
    (sum, a) => sum + a.shares * a.avgPrice,
    0
  );
  const marketValue = stockAllocations.reduce((sum, a) => {
    const price = marketPrices[a.symbol] || a.avgPrice;
    return sum + a.shares * price;
  }, 0);
  const totalValue = model.cashBalance + marketValue;
  const totalPnl = marketValue - investedValue;
  const totalPnlPct = investedValue > 0 ? (totalPnl / investedValue) * 100 : 0;

  // Rebalance helpers
  const rebalanceTotalPct = rebalanceAllocations.reduce(
    (sum, a) => sum + a.percentage,
    0
  );

  const openRebalance = () => {
    setRebalanceAllocations(
      model.allocations.map((a) => ({
        symbol: a.symbol,
        companyName: a.companyName,
        percentage: a.percentage,
      }))
    );
    setRebalanceError("");
    setRebalanceSellPrices({});
    setStockQuery("");
    setStockResults([]);
    setShowRebalance(true);
  };

  const handleRebalancePctChange = (symbol: string, newPct: number) => {
    const old = rebalanceAllocations.find((a) => a.symbol === symbol);
    if (!old) return;
    const diff = newPct - old.percentage;

    setRebalanceAllocations((prev) =>
      prev.map((a) => {
        if (a.symbol === symbol) return { ...a, percentage: newPct };
        if (a.symbol === "CASH" && symbol !== "CASH")
          return { ...a, percentage: Math.max(0, a.percentage - diff) };
        return a;
      })
    );
  };

  const handleRebalanceRemove = (symbol: string) => {
    if (symbol === "CASH") return;
    const removing = rebalanceAllocations.find((a) => a.symbol === symbol);
    if (!removing) return;

    setRebalanceAllocations((prev) =>
      prev
        .filter((a) => a.symbol !== symbol)
        .map((a) =>
          a.symbol === "CASH"
            ? { ...a, percentage: a.percentage + removing.percentage }
            : a
        )
    );
  };

  const handleRebalanceAddStock = (stock: SearchStock) => {
    if (rebalanceAllocations.some((a) => a.symbol === stock.symbol)) return;

    const defaultPct = Math.min(
      10,
      100 -
        rebalanceTotalPct +
        (rebalanceAllocations.find((a) => a.symbol === "CASH")?.percentage || 0)
    );

    setRebalanceAllocations((prev) => {
      const updated = prev.map((a) =>
        a.symbol === "CASH"
          ? { ...a, percentage: Math.max(0, a.percentage - defaultPct) }
          : a
      );
      return [
        ...updated,
        {
          symbol: stock.symbol,
          companyName: stock.company,
          percentage: defaultPct,
        },
      ];
    });
    setMarketPrices((prev) => ({ ...prev, [stock.symbol]: stock.current }));
    setStockQuery("");
    setStockResults([]);
  };

  const handleRebalanceSubmit = async () => {
    if (Math.abs(rebalanceTotalPct - 100) > 0.01) return;
    setRebalanceLoading(true);
    setRebalanceError("");

    try {
      const res = await fetch(`/api/model-portfolios/${id}/rebalance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: rebalanceAllocations,
          customPrices: Object.fromEntries(
            Object.entries(rebalanceSellPrices)
              .filter(([, v]) => v && parseFloat(v) > 0)
              .map(([k, v]) => [k, parseFloat(v)])
          ),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setRebalanceError(data.error || "Rebalance failed");
        return;
      }

      setShowRebalance(false);
      fetchData();
    } catch {
      setRebalanceError("Rebalance failed");
    } finally {
      setRebalanceLoading(false);
    }
  };

  const handleAddCash = async () => {
    const amount = parseFloat(addCashAmount);
    if (!amount || amount <= 0) return;
    setAddCashLoading(true);

    try {
      const res = await fetch(`/api/model-portfolios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addCash: amount }),
      });

      if (res.ok) {
        setShowAddCash(false);
        setAddCashAmount("");
        fetchData();
      }
    } finally {
      setAddCashLoading(false);
    }
  };

  const handleWithdrawCash = async () => {
    const amount = parseFloat(withdrawCashAmount);
    if (!amount || amount <= 0) return;
    setWithdrawCashLoading(true);

    try {
      const res = await fetch(`/api/model-portfolios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawCash: amount }),
      });

      if (res.ok) {
        setShowWithdrawCash(false);
        setWithdrawCashAmount("");
        fetchData();
      }
    } finally {
      setWithdrawCashLoading(false);
    }
  };

  const handleEditInfo = async () => {
    const res = await fetch(`/api/model-portfolios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDescription }),
    });

    if (res.ok) {
      setShowEditInfo(false);
      fetchData();
    }
  };

  const openBulkTrade = () => {
    setBulkTrades([]);
    setBulkTradeError("");
    setStockQuery("");
    setStockResults([]);
    setShowBulkTrade(true);
  };

  const handleBulkTradeAddStock = (stock: SearchStock) => {
    if (bulkTrades.some((t) => t.symbol === stock.symbol)) return;
    setBulkTrades((prev) => [
      ...prev,
      { symbol: stock.symbol, companyName: stock.company, type: "BUY", quantity: "" },
    ]);
    setStockQuery("");
    setStockResults([]);
    setMarketPrices((prev) => ({ ...prev, [stock.symbol]: stock.current }));
  };

  const handleBulkTradeAddHolding = (alloc: Allocation) => {
    if (bulkTrades.some((t) => t.symbol === alloc.symbol)) return;
    setBulkTrades((prev) => [
      ...prev,
      { symbol: alloc.symbol, companyName: alloc.companyName, type: "SELL", quantity: "" },
    ]);
  };

  const handleBulkTradeSubmit = async () => {
    const validTrades = bulkTrades.filter(
      (t) => parseInt(t.quantity) > 0
    );
    if (validTrades.length === 0) return;

    setBulkTradeLoading(true);
    setBulkTradeError("");

    try {
      const res = await fetch(`/api/model-portfolios/${id}/bulk-trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trades: validTrades.map((t) => ({
            symbol: t.symbol,
            companyName: t.companyName,
            type: t.type,
            quantity: parseInt(t.quantity),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setBulkTradeError(data.error || "Bulk trade failed");
        return;
      }

      setShowBulkTrade(false);
      fetchData();
    } catch {
      setBulkTradeError("Bulk trade failed");
    } finally {
      setBulkTradeLoading(false);
    }
  };

  const stockColors = [
    "from-violet-500 to-purple-500",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-500",
    "from-indigo-500 to-blue-500",
    "from-cyan-500 to-sky-500",
    "from-teal-500 to-emerald-500",
  ];

  const barColors = [
    "bg-violet-500",
    "bg-blue-500",
    "bg-cyan-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-indigo-500",
    "bg-teal-500",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 animate-in-up">
        <div>
          <button
            onClick={() => router.push("/models")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Models
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl icon-bg-violet flex items-center justify-center shrink-0">
              <PieChart className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
                {model.name}
                <button
                  onClick={() => {
                    setEditName(model.name);
                    setEditDescription(model.description);
                    setShowEditInfo(true);
                  }}
                  className="text-muted-foreground hover:text-violet-500 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </h1>
              {model.description && (
                <p className="text-sm text-muted-foreground">
                  {model.description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setShowAddCash(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Cash
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setShowWithdrawCash(true)}
          >
            <Minus className="h-4 w-4 mr-1.5" />
            Withdraw
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={openBulkTrade}
          >
            <ShoppingCart className="h-4 w-4 mr-1.5" />
            Bulk Trade
          </Button>
          <Button
            className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
            onClick={openRebalance}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Rebalance
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-in-up-delay-1">
        <Card className="stat-card stat-card-violet rounded-2xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Total Value
            </p>
            <p className="text-xl font-bold font-tabular mt-1">
              PKR {formatPKR(totalValue, { decimals: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="stat-card stat-card-emerald rounded-2xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Cash Balance
            </p>
            <p className="text-xl font-bold font-tabular mt-1">
              PKR {formatPKR(model.cashBalance, { decimals: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="stat-card stat-card-blue rounded-2xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Invested
            </p>
            <p className="text-xl font-bold font-tabular mt-1">
              PKR {formatPKR(investedValue, { decimals: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="stat-card stat-card-cyan rounded-2xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Market Value
            </p>
            <p className="text-xl font-bold font-tabular mt-1">
              PKR {formatPKR(marketValue, { decimals: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card
          className={`stat-card rounded-2xl ${totalPnl >= 0 ? "stat-card-emerald" : "stat-card-rose"}`}
        >
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              P&L
            </p>
            <p
              className={`text-xl font-bold font-tabular mt-1 ${totalPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {totalPnl >= 0 ? "+" : ""}
              {formatPKR(totalPnl, { decimals: 0 })}
            </p>
            <p
              className={`text-xs font-tabular ${totalPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {totalPnlPct >= 0 ? "+" : ""}
              {totalPnlPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Holdings Table */}
      <Card className="rounded-2xl animate-in-up-delay-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet-500" />
            Holdings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stockAllocations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No stocks yet. Click Rebalance to add stocks.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-2 px-2 font-semibold">
                      Stock
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Alloc %
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Shares
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Avg Price
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Current
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Value
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {stockAllocations.map((alloc, i) => {
                    const currentPrice =
                      marketPrices[alloc.symbol] || alloc.avgPrice;
                    const currentValue = alloc.shares * currentPrice;
                    const costBasis = alloc.shares * alloc.avgPrice;
                    const pnl = currentValue - costBasis;
                    const pnlPct =
                      costBasis > 0 ? (pnl / costBasis) * 100 : 0;

                    return (
                      <tr
                        key={alloc.symbol}
                        className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`h-8 w-8 rounded-lg bg-gradient-to-br ${stockColors[i % stockColors.length]} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}
                            >
                              {alloc.symbol.slice(0, 3)}
                            </div>
                            <div>
                              <p className="font-semibold">{alloc.symbol}</p>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                                {alloc.companyName}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-tabular px-1.5 py-0 rounded-md"
                          >
                            {alloc.percentage.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-2 font-tabular font-semibold">
                          {alloc.shares}
                        </td>
                        <td className="text-right py-3 px-2 font-tabular">
                          {formatPKR(alloc.avgPrice)}
                        </td>
                        <td className="text-right py-3 px-2 font-tabular">
                          {formatPKR(currentPrice)}
                        </td>
                        <td className="text-right py-3 px-2 font-tabular font-semibold">
                          {formatPKR(currentValue, { decimals: 0 })}
                        </td>
                        <td className="text-right py-3 px-2">
                          <div
                            className={`font-tabular font-semibold ${pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}
                          >
                            <span className="flex items-center justify-end gap-0.5">
                              {pnl >= 0 ? (
                                <ArrowUpRight className="h-3 w-3" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3" />
                              )}
                              {formatPKR(Math.abs(pnl), { decimals: 0 })}
                            </span>
                            <span className="text-[11px] opacity-80">
                              {pnlPct >= 0 ? "+" : ""}
                              {pnlPct.toFixed(2)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allocation Pie Visual */}
      <Card className="rounded-2xl animate-in-up-delay-3">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-500" />
            Allocation Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-muted rounded-full overflow-hidden flex mb-4">
            {model.allocations
              .filter((a) => a.percentage > 0)
              .map((a, i) => {
                const color =
                  a.symbol === "CASH"
                    ? "bg-slate-400"
                    : barColors[i % barColors.length];
                return (
                  <div
                    key={a.symbol}
                    className={`h-full ${color} transition-all`}
                    style={{ width: `${a.percentage}%` }}
                    title={`${a.symbol}: ${a.percentage.toFixed(1)}%`}
                  />
                );
              })}
          </div>
          <div className="flex flex-wrap gap-3">
            {model.allocations
              .filter((a) => a.percentage > 0)
              .map((a, i) => {
                const color =
                  a.symbol === "CASH"
                    ? "bg-slate-400"
                    : barColors[i % barColors.length];
                return (
                  <div key={a.symbol} className="flex items-center gap-1.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                    <span className="text-xs font-medium">
                      {a.symbol === "CASH" ? "Cash" : a.symbol}
                    </span>
                    <span className="text-xs text-muted-foreground font-tabular">
                      {a.percentage.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      {stockAllocations.length > 0 && (() => {
        const stockPnlData = stockAllocations.map((alloc) => {
          const currentPrice = marketPrices[alloc.symbol] || alloc.avgPrice;
          const currentValue = alloc.shares * currentPrice;
          const costBasis = alloc.shares * alloc.avgPrice;
          const pnl = currentValue - costBasis;
          const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
          return {
            symbol: alloc.symbol,
            pnl,
            pnlPct,
            currentValue,
            costBasis,
          };
        });

        const pieData = [
          ...stockAllocations.map((a) => ({
            name: a.symbol,
            value: a.shares * (marketPrices[a.symbol] || a.avgPrice),
          })),
          ...(model.cashBalance > 0
            ? [{ name: "Cash", value: model.cashBalance }]
            : []),
        ];

        const PIE_COLORS = [
          "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b",
          "#ef4444", "#6366f1", "#14b8a6", "#f97316", "#ec4899",
        ];

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in-up-delay-3">
            {/* P&L by Stock */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-violet-500" />
                  P&L by Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stockPnlData}
                      layout="vertical"
                      margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => formatPKR(v, { decimals: 0 })}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        dataKey="symbol"
                        type="category"
                        tick={{ fontSize: 12, fontWeight: 600 }}
                        width={65}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-sm">
                              <p className="font-semibold">{d.symbol}</p>
                              <p className={d.pnl >= 0 ? "text-emerald-600" : "text-red-500"}>
                                P&L: {d.pnl >= 0 ? "+" : ""}PKR {formatPKR(d.pnl, { decimals: 0 })}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {d.pnlPct >= 0 ? "+" : ""}{d.pnlPct.toFixed(2)}%
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                        {stockPnlData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.pnl >= 0 ? "#10b981" : "#ef4444"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Portfolio Composition Pie */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-violet-500" />
                  Portfolio Composition
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={
                              pieData[i].name === "Cash"
                                ? "#94a3b8"
                                : PIE_COLORS[i % PIE_COLORS.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-sm">
                              <p className="font-semibold">{d.name}</p>
                              <p>PKR {formatPKR(d.value, { decimals: 0 })}</p>
                              <p className="text-muted-foreground text-xs">
                                {totalValue > 0
                                  ? ((d.value / totalValue) * 100).toFixed(1)
                                  : 0}
                                %
                              </p>
                            </div>
                          );
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2.5 mt-3 justify-center">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            d.name === "Cash"
                              ? "#94a3b8"
                              : PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                      <span className="text-xs font-medium">{d.name}</span>
                      <span className="text-xs text-muted-foreground font-tabular">
                        {totalValue > 0
                          ? ((d.value / totalValue) * 100).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Stock Returns */}
            <Card className="rounded-2xl lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                  Stock Returns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stockPnlData
                    .sort((a, b) => b.pnlPct - a.pnlPct)
                    .map((stock) => (
                      <div
                        key={stock.symbol}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{stock.symbol}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Cost: PKR {formatPKR(stock.costBasis, { decimals: 0 })} → Value: PKR{" "}
                            {formatPKR(stock.currentValue, { decimals: 0 })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-bold font-tabular ${
                              stock.pnl >= 0 ? "text-emerald-600" : "text-red-500"
                            }`}
                          >
                            {stock.pnl >= 0 ? "+" : ""}PKR {formatPKR(stock.pnl, { decimals: 0 })}
                          </p>
                          <p
                            className={`text-xs font-tabular ${
                              stock.pnl >= 0 ? "text-emerald-600" : "text-red-500"
                            }`}
                          >
                            {stock.pnlPct >= 0 ? "+" : ""}{stock.pnlPct.toFixed(2)}%
                          </p>
                        </div>
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              stock.pnl >= 0 ? "bg-emerald-500" : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.min(100, Math.abs(stock.pnlPct))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Transaction History */}
      <Card className="rounded-2xl animate-in-up-delay-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-violet-500" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {model.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transactions yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {model.transactions.map((tx) => {
                const isBuy = tx.type === "BUY";
                const isSell = tx.type === "SELL";
                const isCash =
                  tx.type === "CASH_IN" || tx.type === "CASH_OUT";

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                          isBuy
                            ? "bg-emerald-500/10 text-emerald-600"
                            : isSell
                              ? "bg-red-500/10 text-red-500"
                              : "bg-blue-500/10 text-blue-500"
                        }`}
                      >
                        {isBuy ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : isSell ? (
                          <ArrowDownRight className="h-4 w-4" />
                        ) : (
                          <DollarSign className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {isCash ? tx.companyName : `${tx.type} ${tx.symbol}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {isCash
                            ? ""
                            : `${tx.quantity} shares @ PKR ${formatPKR(tx.price)}`}
                          {!isCash && " · "}
                          {new Date(tx.createdAt).toLocaleDateString("en-PK", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-tabular font-semibold text-sm ${
                        isBuy || tx.type === "CASH_OUT"
                          ? "text-red-500"
                          : "text-emerald-600"
                      }`}
                    >
                      {isBuy || tx.type === "CASH_OUT" ? "-" : "+"}PKR{" "}
                      {formatPKR(tx.total, { decimals: 0 })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════ */}
      {/* Add Cash Dialog                    */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showAddCash} onOpenChange={setShowAddCash}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              Add Cash
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Amount (PKR)</Label>
              <Input
                type="number"
                min="0"
                value={addCashAmount}
                onChange={(e) => setAddCashAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="rounded-xl font-tabular text-lg"
              />
              <p className="text-[11px] text-muted-foreground">
                Current balance:{" "}
                <span className="font-tabular font-semibold text-foreground">
                  PKR {formatPKR(model.cashBalance, { decimals: 0 })}
                </span>
              </p>
            </div>
            <Button
              onClick={handleAddCash}
              disabled={
                addCashLoading ||
                !addCashAmount ||
                parseFloat(addCashAmount) <= 0
              }
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
            >
              {addCashLoading ? "Adding..." : "Add Cash"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* Withdraw Cash Dialog               */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showWithdrawCash} onOpenChange={setShowWithdrawCash}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Minus className="h-5 w-5 text-red-500" />
              Withdraw Cash
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Amount (PKR)</Label>
              <Input
                type="number"
                min="0"
                max={model.cashBalance}
                value={withdrawCashAmount}
                onChange={(e) => setWithdrawCashAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="rounded-xl font-tabular text-lg"
              />
              <p className="text-[11px] text-muted-foreground">
                Available:{" "}
                <span className="font-tabular font-semibold text-foreground">
                  PKR {formatPKR(model.cashBalance, { decimals: 0 })}
                </span>
              </p>
              {parseFloat(withdrawCashAmount) > model.cashBalance && (
                <p className="text-[11px] text-red-500 font-semibold">
                  Amount exceeds available cash balance
                </p>
              )}
            </div>
            <Button
              onClick={handleWithdrawCash}
              disabled={
                withdrawCashLoading ||
                !withdrawCashAmount ||
                parseFloat(withdrawCashAmount) <= 0 ||
                parseFloat(withdrawCashAmount) > model.cashBalance
              }
              className="w-full rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold"
            >
              {withdrawCashLoading ? "Withdrawing..." : "Withdraw Cash"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* Edit Info Dialog                   */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showEditInfo} onOpenChange={setShowEditInfo}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Model Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <Button
              onClick={handleEditInfo}
              disabled={!editName.trim()}
              className="w-full rounded-xl"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* Rebalance Dialog                   */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showRebalance} onOpenChange={setShowRebalance}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-violet-500" />
              Rebalance Portfolio
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Add stocks search */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Add New Stock</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={stockQuery}
                  onChange={(e) => setStockQuery(e.target.value)}
                  placeholder="Search stocks..."
                  className="pl-9 rounded-xl"
                />
              </div>
              {stockResults.length > 0 && (
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {stockResults.map((stock) => (
                    <button
                      key={stock.symbol}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 hover:bg-violet-500/10 border border-border/50 hover:border-violet-500/30 transition-all text-left group"
                      onClick={() => handleRebalanceAddStock(stock)}
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-sm group-hover:text-violet-600">
                          {stock.symbol}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-2">
                          {stock.company}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-tabular">
                          PKR {formatPKR(stock.current)}
                        </span>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-violet-500" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchLoading && stockQuery.length > 0 && (
                <p className="text-xs text-muted-foreground">Searching...</p>
              )}
            </div>

            {/* Allocations editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Allocations</Label>
                <span
                  className={`text-xs font-bold font-tabular ${
                    Math.abs(rebalanceTotalPct - 100) < 0.01
                      ? "text-emerald-600"
                      : "text-amber-500"
                  }`}
                >
                  {rebalanceTotalPct.toFixed(1)}% / 100%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                {rebalanceAllocations
                  .filter((a) => a.percentage > 0)
                  .map((a, i) => {
                    const color =
                      a.symbol === "CASH"
                        ? "bg-slate-400"
                        : barColors[i % barColors.length];
                    return (
                      <div
                        key={a.symbol}
                        className={`h-full ${color} transition-all`}
                        style={{ width: `${a.percentage}%` }}
                      />
                    );
                  })}
              </div>

              <div className="space-y-2">
                {rebalanceAllocations.map((alloc) => {
                  // Show what will change
                  const existing = model.allocations.find(
                    (a) => a.symbol === alloc.symbol
                  );
                  const currentShares = existing?.shares || 0;
                  const price = marketPrices[alloc.symbol] || 0;
                  const targetValue =
                    (alloc.percentage / 100) * totalValue;
                  const targetShares =
                    alloc.symbol !== "CASH" && price > 0
                      ? Math.floor(targetValue / price)
                      : 0;
                  const diff = targetShares - currentShares;

                  return (
                    <div
                      key={alloc.symbol}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {alloc.symbol === "CASH"
                            ? "Cash Reserve"
                            : alloc.symbol}
                        </p>
                        {alloc.symbol !== "CASH" && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {alloc.companyName}
                          </p>
                        )}
                        {/* Trade preview */}
                        {alloc.symbol !== "CASH" && price > 0 && (
                          <>
                            <p className="text-[11px] mt-0.5">
                              <span className="text-muted-foreground">
                                {currentShares} → {targetShares} shares
                              </span>
                              {diff !== 0 && (() => {
                                const tradePrice = diff < 0 && rebalanceSellPrices[alloc.symbol] && parseFloat(rebalanceSellPrices[alloc.symbol]) > 0
                                  ? parseFloat(rebalanceSellPrices[alloc.symbol])
                                  : price;
                                const pnlPerShare = diff < 0 ? tradePrice - (existing?.avgPrice || 0) : 0;
                                const totalPnlTrade = diff < 0 ? pnlPerShare * Math.abs(diff) : 0;
                                return (
                                  <span
                                    className={`ml-1.5 font-semibold ${diff > 0 ? "text-emerald-600" : "text-red-500"}`}
                                  >
                                    ({diff > 0 ? "+" : ""}
                                    {diff} = {diff > 0 ? "BUY" : "SELL"} PKR{" "}
                                    {formatPKR(Math.abs(diff) * tradePrice, {
                                      decimals: 0,
                                    })}
                                    {diff < 0 && (
                                      <span className={totalPnlTrade >= 0 ? "text-emerald-600" : "text-red-500"}>
                                        {" "}· {totalPnlTrade >= 0 ? "Profit" : "Loss"} PKR {formatPKR(Math.abs(totalPnlTrade), { decimals: 0 })}
                                      </span>
                                    )}
                                    )
                                  </span>
                                );
                              })()}
                            </p>
                            {/* Price input when shares are being bought or sold */}
                            {diff !== 0 && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <Label className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {diff < 0 ? "Sell" : "Buy"} @
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder={`Market: ${formatPKR(price)}`}
                                  value={rebalanceSellPrices[alloc.symbol] || ""}
                                  onChange={(e) =>
                                    setRebalanceSellPrices((prev) => ({
                                      ...prev,
                                      [alloc.symbol]: e.target.value,
                                    }))
                                  }
                                  className="w-36 h-7 rounded-lg font-tabular text-xs"
                                />
                                {diff < 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    Avg: {formatPKR(existing?.avgPrice || 0)}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={alloc.percentage}
                          onChange={(e) =>
                            handleRebalancePctChange(
                              alloc.symbol,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-20 h-8 rounded-lg font-tabular text-center text-sm"
                        />
                        <span className="text-xs text-muted-foreground font-semibold">
                          %
                        </span>
                        {alloc.symbol !== "CASH" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() =>
                              handleRebalanceRemove(alloc.symbol)
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {rebalanceError && (
              <div className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
                {rebalanceError}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setShowRebalance(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRebalanceSubmit}
                disabled={
                  rebalanceLoading ||
                  Math.abs(rebalanceTotalPct - 100) > 0.01
                }
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
              >
                {rebalanceLoading
                  ? "Rebalancing..."
                  : "Confirm Rebalance"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* Bulk Trade Dialog                  */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showBulkTrade} onOpenChange={setShowBulkTrade}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-500" />
              Bulk Trade
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Quick add from existing holdings */}
            {stockAllocations.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Quick Sell Holdings</Label>
                <div className="flex flex-wrap gap-1.5">
                  {stockAllocations
                    .filter((a) => !bulkTrades.some((t) => t.symbol === a.symbol))
                    .map((a) => (
                      <button
                        key={a.symbol}
                        onClick={() => handleBulkTradeAddHolding(a)}
                        className="px-2.5 py-1 rounded-lg bg-muted/40 hover:bg-red-500/10 border border-border/50 hover:border-red-500/30 text-xs font-semibold transition-all"
                      >
                        {a.symbol} ({a.shares})
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Search to add buy */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Add Stock to Buy</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={stockQuery}
                  onChange={(e) => setStockQuery(e.target.value)}
                  placeholder="Search stocks..."
                  className="pl-9 rounded-xl"
                />
              </div>
              {stockResults.length > 0 && (
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {stockResults.map((stock) => (
                    <button
                      key={stock.symbol}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 hover:bg-emerald-500/10 border border-border/50 hover:border-emerald-500/30 transition-all text-left group"
                      onClick={() => handleBulkTradeAddStock(stock)}
                    >
                      <div>
                        <span className="font-semibold text-sm group-hover:text-emerald-600">
                          {stock.symbol}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-2">
                          {stock.company}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-tabular">
                          PKR {formatPKR(stock.current)}
                        </span>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-emerald-500" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Trade list */}
            {bulkTrades.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Trades ({bulkTrades.length})
                </Label>
                {bulkTrades.map((trade) => {
                  const price = marketPrices[trade.symbol] || 0;
                  const qty = parseInt(trade.quantity) || 0;
                  const total = qty * price;

                  return (
                    <div
                      key={trade.symbol}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{trade.symbol}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {price > 0
                            ? `@ PKR ${formatPKR(price)}`
                            : "Price unavailable"}
                          {qty > 0 && price > 0 && (
                            <span className="ml-1.5 font-semibold text-foreground">
                              = PKR {formatPKR(total, { decimals: 0 })}
                            </span>
                          )}
                        </p>
                      </div>
                      <select
                        value={trade.type}
                        onChange={(e) =>
                          setBulkTrades((prev) =>
                            prev.map((t) =>
                              t.symbol === trade.symbol
                                ? { ...t, type: e.target.value as "BUY" | "SELL" }
                                : t
                            )
                          )
                        }
                        className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-semibold"
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Qty"
                        value={trade.quantity}
                        onChange={(e) =>
                          setBulkTrades((prev) =>
                            prev.map((t) =>
                              t.symbol === trade.symbol
                                ? { ...t, quantity: e.target.value }
                                : t
                            )
                          )
                        }
                        className="w-20 h-8 rounded-lg font-tabular text-center text-sm"
                      />
                      <button
                        onClick={() =>
                          setBulkTrades((prev) =>
                            prev.filter((t) => t.symbol !== trade.symbol)
                          )
                        }
                        className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cash info */}
            <p className="text-[11px] text-muted-foreground">
              Available cash:{" "}
              <span className="font-tabular font-semibold text-foreground">
                PKR {formatPKR(model.cashBalance, { decimals: 0 })}
              </span>
            </p>

            {bulkTradeError && (
              <div className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
                {bulkTradeError}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setShowBulkTrade(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkTradeSubmit}
                disabled={
                  bulkTradeLoading ||
                  bulkTrades.filter((t) => parseInt(t.quantity) > 0).length === 0
                }
                className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
              >
                {bulkTradeLoading
                  ? "Executing..."
                  : `Execute ${bulkTrades.filter((t) => parseInt(t.quantity) > 0).length} Trade(s)`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
