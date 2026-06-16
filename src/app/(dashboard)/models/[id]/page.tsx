"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Wallet,
  Plus,
  X,
  Search,
  RefreshCw,
  DollarSign,
  Pencil,
  Minus,
  ShoppingCart,
  Trash2,
  Hash,
  Percent,
  Sparkles,
} from "lucide-react";
import { formatPKR } from "@/lib/market-status";
import {
  ResponsiveContainer,
  Tooltip,
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

/* Avatar tint palette (per ticker) — copied from market/page.tsx */
const TINTS = ["#2563EB", "#7C3AED", "#0D9488", "#DB2777", "#CA8A04", "#0891B2", "#16A34A", "#4F46E5"];
function tint(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/* Allocation / donut palette (NOT P&L) */
const ALLOC_COLORS = ["#7C3AED", "#0D9488", "#2563EB", "#0891B2", "#CA8A04", "#DB2777"];
const CASH_COLOR = "#CBD5E1";

const TOOLTIP_STYLE = {
  background: "var(--color-card)",
  border: "1px solid var(--color-line)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--color-ink)",
  boxShadow: "var(--shadow-pop)",
} as const;

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

  // Edit holding (avg price / shares) dialog
  const [showEditHolding, setShowEditHolding] = useState(false);
  const [editHoldingSymbol, setEditHoldingSymbol] = useState("");
  const [editHoldingName, setEditHoldingName] = useState("");
  const [editHoldingAvg, setEditHoldingAvg] = useState("");
  const [editHoldingShares, setEditHoldingShares] = useState("");
  const [editHoldingLoading, setEditHoldingLoading] = useState(false);
  const [editHoldingError, setEditHoldingError] = useState("");

  // Rebalance mode
  const [showRebalance, setShowRebalance] = useState(false);
  const [rebalanceAllocations, setRebalanceAllocations] = useState<
    { symbol: string; companyName: string; percentage: number; inputShares?: number }[]
  >([]);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [rebalanceError, setRebalanceError] = useState("");
  const [rebalanceMode, setRebalanceMode] = useState<"percent" | "shares">("percent");

  // Rebalance confirmation popup (step 2: enter trade prices)
  const [showRebalanceConfirm, setShowRebalanceConfirm] = useState(false);
  const [rebalanceTrades, setRebalanceTrades] = useState<
    {
      symbol: string;
      companyName: string;
      type: "BUY" | "SELL";
      shares: number;
      marketPrice: number;
      avgPrice: number;
      price: string;
    }[]
  >([]);

  // Bulk trade
  const [showBulkTrade, setShowBulkTrade] = useState(false);
  const [bulkTrades, setBulkTrades] = useState<
    { symbol: string; companyName: string; type: "BUY" | "SELL"; quantity: string }[]
  >([]);
  const [bulkTradeLoading, setBulkTradeLoading] = useState(false);
  const [bulkTradeError, setBulkTradeError] = useState("");

  // SIP (Systematic Investment Plan) dialog
  const [showSip, setShowSip] = useState(false);
  const [sipAmount, setSipAmount] = useState("");
  const [sipBasis, setSipBasis] = useState<"current" | "target">("current");
  const [sipPlan, setSipPlan] = useState<
    { symbol: string; companyName: string; shares: number; price: string; marketPrice: number; weight: number }[]
  >([]);
  const [sipLoading, setSipLoading] = useState(false);
  const [sipError, setSipError] = useState("");
  const [showSipConfirm, setShowSipConfirm] = useState(false);

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

  // Recompute SIP plan when amount/basis/model/prices change
  useEffect(() => {
    const amount = parseFloat(sipAmount);
    if (!amount || amount <= 0 || !model) {
      setSipPlan([]);
      return;
    }
    const stockAllocs = model.allocations.filter((a) => a.symbol !== "CASH");
    if (stockAllocs.length === 0) {
      setSipPlan([]);
      return;
    }

    let weights: { symbol: string; companyName: string; weight: number; price: number }[] = [];

    if (sipBasis === "current") {
      const totalMktValue = stockAllocs.reduce((sum, a) => {
        const price = marketPrices[a.symbol] || a.avgPrice;
        return sum + a.shares * price;
      }, 0);
      if (totalMktValue <= 0) {
        setSipPlan([]);
        return;
      }
      weights = stockAllocs.map((a) => {
        const price = marketPrices[a.symbol] || a.avgPrice;
        const value = a.shares * price;
        return {
          symbol: a.symbol,
          companyName: a.companyName,
          weight: value / totalMktValue,
          price,
        };
      });
    } else {
      const totalPct = stockAllocs.reduce((sum, a) => sum + a.percentage, 0);
      if (totalPct <= 0) {
        setSipPlan([]);
        return;
      }
      weights = stockAllocs.map((a) => ({
        symbol: a.symbol,
        companyName: a.companyName,
        weight: a.percentage / totalPct,
        price: marketPrices[a.symbol] || a.avgPrice,
      }));
    }

    const plan = weights
      .map((w) => {
        const targetAmount = amount * w.weight;
        const shares = w.price > 0 ? Math.floor(targetAmount / w.price) : 0;
        return {
          symbol: w.symbol,
          companyName: w.companyName,
          shares,
          price: String(w.price),
          marketPrice: w.price,
          weight: w.weight,
        };
      })
      .filter((t) => t.shares > 0);

    setSipPlan(plan);
  }, [sipAmount, sipBasis, model, marketPrices]);

  if (loading || !model) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-ink-3" />
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
  const totalUp = totalPnl >= 0;

  // Live allocation % — derived from current market values so they always
  // reflect the latest prices/holdings (never stale stored percentages).
  const livePct = (symbol: string) => {
    if (totalValue <= 0) return 0;
    if (symbol === "CASH") return (model.cashBalance / totalValue) * 100;
    const alloc = stockAllocations.find((a) => a.symbol === symbol);
    if (!alloc) return 0;
    const price = marketPrices[symbol] || alloc.avgPrice;
    return (alloc.shares * price) / totalValue * 100;
  };

  // Unified breakdown (stocks + cash) used by the bar and legend.
  const allocationBreakdown = [
    ...stockAllocations.map((a) => ({
      symbol: a.symbol,
      label: a.symbol,
      pct: livePct(a.symbol),
    })),
    { symbol: "CASH", label: "Cash", pct: livePct("CASH") },
  ]
    .filter((a) => a.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  const allocColor = (symbol: string, i: number) =>
    symbol === "CASH" ? CASH_COLOR : ALLOC_COLORS[i % ALLOC_COLORS.length];

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
        inputShares: a.symbol !== "CASH" ? a.shares : undefined,
      }))
    );
    setRebalanceError("");
    setRebalanceTrades([]);
    setRebalanceMode("percent");
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

  // Rebalance: change target shares and recalc only the changed stock's % + CASH
  const handleRebalanceSharesChange = (symbol: string, newShares: number) => {
    setRebalanceAllocations((prev) => {
      if (totalValue <= 0) {
        return prev.map((a) =>
          a.symbol === symbol ? { ...a, inputShares: newShares } : a
        );
      }

      // Calculate new percentage for the changed stock
      const price = marketPrices[symbol] || 0;
      const newPct = price > 0 ? Math.round((newShares * price / totalValue) * 1000) / 10 : 0;

      // Find old percentage for this stock
      const oldAlloc = prev.find((a) => a.symbol === symbol);
      const oldPct = oldAlloc?.percentage ?? 0;
      const diff = newPct - oldPct;

      return prev.map((a) => {
        if (a.symbol === symbol) return { ...a, inputShares: newShares, percentage: newPct };
        if (a.symbol === "CASH") return { ...a, percentage: Math.max(0, Math.round((a.percentage - diff) * 10) / 10) };
        return a;
      });
    });
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
      const newAlloc: typeof updated[0] = {
        symbol: stock.symbol,
        companyName: stock.company,
        percentage: defaultPct,
      };
      if (rebalanceMode === "shares" && stock.current > 0 && totalValue > 0) {
        const targetValue = (defaultPct / 100) * totalValue;
        newAlloc.inputShares = Math.floor(targetValue / stock.current);
      }
      return [...updated, newAlloc];
    });
    setMarketPrices((prev) => ({ ...prev, [stock.symbol]: stock.current }));
    setStockQuery("");
    setStockResults([]);
  };

  // Step 1: User clicks "Review Trades" — only show trades for stocks whose % actually changed
  const handleRebalanceNext = () => {
    if (Math.abs(rebalanceTotalPct - 100) > 1) return;

    // Build a map of original percentages
    const originalPctMap = new Map(
      model.allocations.map((a) => [a.symbol, a.percentage])
    );

    const trades: typeof rebalanceTrades = [];
    for (const alloc of rebalanceAllocations) {
      if (alloc.symbol === "CASH") continue;

      const existing = model.allocations.find((a) => a.symbol === alloc.symbol);
      const currentShares = existing?.shares || 0;
      const mktPrice = marketPrices[alloc.symbol] || 0;

      // Determine target shares
      let targetShares: number;
      if (rebalanceMode === "shares" && alloc.inputShares != null) {
        targetShares = alloc.inputShares;
      } else {
        // Percent mode: only recalculate for stocks whose % actually changed
        const originalPct = originalPctMap.get(alloc.symbol) ?? -1;
        const pctChanged = Math.abs(alloc.percentage - originalPct) > 0.01;
        if (!pctChanged) continue; // unchanged stock — skip entirely
        if (mktPrice <= 0) continue;
        targetShares = Math.floor(((alloc.percentage / 100) * totalValue) / mktPrice);
      }

      const diff = targetShares - currentShares;
      if (diff === 0) continue;

      trades.push({
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        type: diff > 0 ? "BUY" : "SELL",
        shares: Math.abs(diff),
        marketPrice: mktPrice,
        avgPrice: existing?.avgPrice || 0,
        price: "",
      });
    }

    // Also include removed stocks (percentage went from >0 to not in list)
    const newSymbols = new Set(rebalanceAllocations.map((a) => a.symbol));
    for (const existing of model.allocations) {
      if (existing.symbol === "CASH") continue;
      if (!newSymbols.has(existing.symbol) && existing.shares > 0) {
        const mktPrice = marketPrices[existing.symbol] || existing.avgPrice;
        trades.push({
          symbol: existing.symbol,
          companyName: existing.companyName,
          type: "SELL",
          shares: existing.shares,
          marketPrice: mktPrice,
          avgPrice: existing.avgPrice,
          price: "",
        });
      }
    }

    if (trades.length === 0) {
      // No actual trades needed, just submit directly
      handleRebalanceSubmit({});
      return;
    }

    setRebalanceTrades(trades);
    setShowRebalanceConfirm(true);
  };

  // Step 2: User enters prices and confirms — submit to API
  const handleRebalanceSubmit = async (customPricesOverride?: Record<string, number>) => {
    setRebalanceLoading(true);
    setRebalanceError("");

    const customPrices = customPricesOverride ?? Object.fromEntries(
      rebalanceTrades
        .filter((t) => t.price && parseFloat(t.price) > 0)
        .map((t) => [t.symbol, parseFloat(t.price)])
    );

    try {
      const res = await fetch(`/api/model-portfolios/${id}/rebalance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: rebalanceAllocations.map((a) => {
            if (a.symbol === "CASH") {
              return { symbol: a.symbol, companyName: a.companyName, percentage: a.percentage };
            }
            if (rebalanceMode === "shares" && a.inputShares != null) {
              // Shares mode: always use explicit inputShares
              return { symbol: a.symbol, companyName: a.companyName, percentage: a.percentage, exactShares: a.inputShares };
            }
            // Percent mode: use current shares for unchanged stocks, recalculate only for changed ones
            const originalPct = model.allocations.find((o) => o.symbol === a.symbol)?.percentage ?? -1;
            const pctChanged = Math.abs(a.percentage - originalPct) > 0.01;
            const existingShares = model.allocations.find((o) => o.symbol === a.symbol)?.shares ?? 0;
            const mktPrice = marketPrices[a.symbol] || 0;
            const exactShares = pctChanged && mktPrice > 0
              ? Math.floor(((a.percentage / 100) * totalValue) / mktPrice)
              : existingShares;
            return { symbol: a.symbol, companyName: a.companyName, percentage: a.percentage, exactShares };
          }),
          customPrices,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setRebalanceError(data.error || "Rebalance failed");
        return;
      }

      setShowRebalanceConfirm(false);
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

  // ═══════════════════════════════════
  // Edit Holding (correct avg price / shares)
  // ═══════════════════════════════════
  const openEditHolding = (alloc: Allocation) => {
    setEditHoldingSymbol(alloc.symbol);
    setEditHoldingName(alloc.companyName);
    setEditHoldingAvg(String(alloc.avgPrice));
    setEditHoldingShares(String(alloc.shares));
    setEditHoldingError("");
    setShowEditHolding(true);
  };

  const handleEditHoldingSubmit = async () => {
    const avg = parseFloat(editHoldingAvg);
    const shares = parseInt(editHoldingShares);
    if (isNaN(avg) || avg < 0) {
      setEditHoldingError("Enter a valid average price");
      return;
    }
    if (isNaN(shares) || shares < 0) {
      setEditHoldingError("Enter a valid share count");
      return;
    }
    setEditHoldingLoading(true);
    setEditHoldingError("");
    try {
      const res = await fetch(`/api/model-portfolios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editHolding: { symbol: editHoldingSymbol, avgPrice: avg, shares },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditHoldingError(data.error || "Failed to update holding");
        return;
      }
      setShowEditHolding(false);
      fetchData();
    } catch {
      setEditHoldingError("Failed to update holding");
    } finally {
      setEditHoldingLoading(false);
    }
  };

  // ═══════════════════════════════════
  // SIP (Systematic Investment Plan)
  // ═══════════════════════════════════
  const openSip = () => {
    setSipAmount("");
    setSipPlan([]);
    setSipError("");
    setSipBasis("current");
    setShowSip(true);
  };

  // Step 1: User reviews plan, clicks "Review & Confirm"
  const handleSipNext = () => {
    if (sipPlan.length === 0) {
      setSipError("Nothing to buy. Check the amount or add stocks to the portfolio first.");
      return;
    }
    setSipError("");
    setShowSipConfirm(true);
  };

  // Step 2: Submit via bulk-trade API
  const handleSipSubmit = async () => {
    if (!model) return;
    const amount = parseFloat(sipAmount);
    if (!amount || amount <= 0) return;

    setSipLoading(true);
    setSipError("");

    try {
      // First add cash, then execute bulk buys
      const addRes = await fetch(`/api/model-portfolios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addCash: amount }),
      });
      if (!addRes.ok) {
        const data = await addRes.json();
        setSipError(data.error || "Failed to add SIP cash");
        return;
      }

      const trades = sipPlan
        .filter((p) => p.shares > 0)
        .map((p) => ({
          symbol: p.symbol,
          companyName: p.companyName,
          type: "BUY" as const,
          quantity: p.shares,
          price: parseFloat(p.price) > 0 ? parseFloat(p.price) : undefined,
        }));

      if (trades.length > 0) {
        const buyRes = await fetch(`/api/model-portfolios/${id}/bulk-trade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trades }),
        });
        if (!buyRes.ok) {
          const data = await buyRes.json();
          setSipError(data.error || "Failed to execute SIP buys");
          return;
        }
      }

      setShowSipConfirm(false);
      setShowSip(false);
      fetchData();
    } catch {
      setSipError("SIP failed");
    } finally {
      setSipLoading(false);
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

  // ── Derived chart data (stocks present) ──
  const stockPnlData = stockAllocations.map((alloc) => {
    const currentPrice = marketPrices[alloc.symbol] || alloc.avgPrice;
    const currentValue = alloc.shares * currentPrice;
    const costBasis = alloc.shares * alloc.avgPrice;
    const pnl = currentValue - costBasis;
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    return { symbol: alloc.symbol, pnl, pnlPct, currentValue, costBasis };
  });
  const maxAbsPnl = Math.max(1, ...stockPnlData.map((d) => Math.abs(d.pnl)));

  const pieData = [
    ...stockAllocations.map((a) => ({
      name: a.symbol,
      value: a.shares * (marketPrices[a.symbol] || a.avgPrice),
    })),
    ...(model.cashBalance > 0 ? [{ name: "Cash", value: model.cashBalance }] : []),
  ];

  return (
    <>
      {/* ── Page header: back link + name + edit pencil + actions ── */}
      <div className="mb-[18px]">
        <button
          onClick={() => router.push("/models")}
          className="mb-3.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="h-[15px] w-[15px]" />
          Back to Models
        </button>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] bg-brand text-white shadow-[0_6px_16px_rgba(37,99,235,.25)]">
              <RefreshCw className="h-[22px] w-[22px]" />
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[24px] font-bold tracking-[-.03em]">{model.name}</h1>
                <span className="rounded-full bg-brand/10 px-2 py-[3px] text-[10.5px] font-semibold text-brand">
                  MODEL
                </span>
                <button
                  onClick={() => {
                    setEditName(model.name);
                    setEditDescription(model.description);
                    setShowEditInfo(true);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-lg text-ink-3 hover:bg-ink/[.04] hover:text-brand"
                  title="Edit info"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {model.description && (
                <div className="mt-0.5 max-w-[520px] text-[13px] text-ink-3">
                  {model.description}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowAddCash(true)}
              className="flex h-10 items-center gap-2 rounded-[11px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105"
            >
              <Plus className="h-[15px] w-[15px]" />
              Add Cash
            </button>
            <button
              onClick={() => setShowWithdrawCash(true)}
              className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04]"
            >
              <Minus className="h-[15px] w-[15px]" />
              Withdraw
            </button>
            <button
              onClick={openBulkTrade}
              className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04]"
            >
              <ShoppingCart className="h-[15px] w-[15px]" />
              Bulk Trade
            </button>
            <button
              onClick={openSip}
              className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04]"
            >
              <Sparkles className="h-[15px] w-[15px]" />
              SIP
            </button>
            <button
              onClick={openRebalance}
              className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04]"
            >
              <RefreshCw className="h-[15px] w-[15px]" />
              Rebalance
            </button>
          </div>
        </div>
      </div>

      {/* ── Hero: Total Value + P&L badge + metric strip ── */}
      <section className="mb-[18px] rounded-2xl border border-line bg-card p-[22px] shadow-card">
        <div className="mb-2 text-[13px] font-medium text-ink-2">Total Value</div>
        <div className="flex flex-wrap items-baseline gap-3">
          <div className="num whitespace-nowrap text-[38px] font-bold leading-none tracking-[-.035em]">
            Rs {formatPKR(totalValue, { decimals: 0 })}
          </div>
          <span
            className="num rounded-lg px-2.5 py-1 text-[13px] font-semibold"
            style={{
              color: totalUp ? "var(--color-gain)" : "var(--color-loss-strong)",
              background: totalUp ? "var(--color-gain-50)" : "var(--color-loss-50)",
            }}
          >
            {totalUp ? "▲" : "▼"} {totalUp ? "+" : ""}
            {totalPnlPct.toFixed(2)}%
          </span>
        </div>
        <div className="mt-2.5 text-[13px] text-ink-3">
          {totalUp ? "Up" : "Down"} Rs {formatPKR(Math.abs(totalPnl), { decimals: 0 })} all time
        </div>
        <div className="mt-[22px] flex flex-wrap gap-[22px] border-t border-line pt-5">
          <div className="min-w-[90px] flex-1">
            <div className="mb-1.5 text-[12px] text-ink-2">Cash</div>
            <div className="num text-[20px] font-bold tracking-[-.02em]">
              Rs {formatPKR(model.cashBalance, { decimals: 0 })}
            </div>
          </div>
          <div className="min-w-[90px] flex-1">
            <div className="mb-1.5 text-[12px] text-ink-2">Invested</div>
            <div className="num text-[20px] font-bold tracking-[-.02em]">
              Rs {formatPKR(investedValue, { decimals: 0 })}
            </div>
          </div>
          <div className="min-w-[90px] flex-1">
            <div className="mb-1.5 text-[12px] text-ink-2">Market Value</div>
            <div className="num text-[20px] font-bold tracking-[-.02em]">
              Rs {formatPKR(marketValue, { decimals: 0 })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Holdings table ── */}
      <section className="mb-[18px] rounded-2xl border border-line bg-card shadow-card">
        <div className="flex items-center justify-between px-[22px] pb-3 pt-[22px]">
          <h2 className="text-[16px] font-bold">Holdings</h2>
          <span className="text-[12px] text-ink-3">
            {stockAllocations.length} stock{stockAllocations.length !== 1 ? "s" : ""}
          </span>
        </div>
        {stockAllocations.length === 0 ? (
          <p className="px-[22px] py-10 text-center text-sm text-ink-3">
            No stocks yet. Click Rebalance to add stocks.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[1.9fr_.8fr_.8fr_.9fr_.9fr_1fr_.9fr_40px] gap-2 border-b border-line px-[22px] pb-2.5 text-[11px] font-semibold tracking-[.03em] text-ink-3">
                <span>STOCK</span>
                <span className="text-right">ALLOC</span>
                <span className="text-right">SHARES</span>
                <span className="text-right">AVG</span>
                <span className="text-right">CURRENT</span>
                <span className="text-right">VALUE</span>
                <span className="text-right">P&amp;L</span>
                <span></span>
              </div>
              {stockAllocations.map((alloc) => {
                const currentPrice = marketPrices[alloc.symbol] || alloc.avgPrice;
                const currentValue = alloc.shares * currentPrice;
                const costBasis = alloc.shares * alloc.avgPrice;
                const pnl = currentValue - costBasis;
                const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
                const up = pnl >= 0;
                const c = tint(alloc.symbol);
                return (
                  <div
                    key={alloc.symbol}
                    className="grid grid-cols-[1.9fr_.8fr_.8fr_.9fr_.9fr_1fr_.9fr_40px] items-center gap-2 border-b border-line-soft px-[22px] py-[11px] hover:bg-ink/[.03]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[10.5px] font-bold"
                        style={{ background: `${c}22`, color: c }}
                      >
                        {alloc.symbol.slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">{alloc.symbol}</div>
                        <div className="truncate text-[11px] text-ink-3">
                          {alloc.companyName}
                        </div>
                      </div>
                    </div>
                    <span className="num text-right text-[12.5px] font-semibold">
                      {livePct(alloc.symbol).toFixed(1)}%
                    </span>
                    <span className="num text-right text-[12.5px]">{alloc.shares}</span>
                    <span className="num text-right text-[12.5px] text-ink-2">
                      {formatPKR(alloc.avgPrice)}
                    </span>
                    <span className="num text-right text-[12.5px] font-semibold">
                      {formatPKR(currentPrice)}
                    </span>
                    <span className="num text-right text-[12.5px] font-semibold">
                      {formatPKR(currentValue, { decimals: 0 })}
                    </span>
                    <span
                      className="num text-right text-[12.5px] font-semibold"
                      style={{ color: up ? "var(--color-gain)" : "var(--color-loss-strong)" }}
                    >
                      {up ? "+" : ""}
                      {pnlPct.toFixed(2)}%
                    </span>
                    <button
                      onClick={() => openEditHolding(alloc)}
                      title="Edit avg price / shares"
                      className="grid h-7 w-7 place-items-center justify-self-end rounded-lg text-ink-3 hover:bg-ink/[.04] hover:text-brand"
                    >
                      <Pencil className="h-[14px] w-[14px]" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Allocation Breakdown + Portfolio Composition (donut) ── */}
      <div className="mb-[18px] grid gap-[18px] lg:grid-cols-[1.2fr_1fr]">
        {/* Allocation Breakdown bar + legend */}
        <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-4 text-[15px] font-bold">Allocation Breakdown</div>
          {allocationBreakdown.length === 0 ? (
            <div className="flex h-[120px] items-center justify-center">
              <p className="text-xs text-ink-3">No allocation yet</p>
            </div>
          ) : (
            <>
              <div className="mb-[18px] flex h-3 overflow-hidden rounded-md">
                {allocationBreakdown.map((a, i) => (
                  <span
                    key={a.symbol}
                    style={{ width: `${a.pct}%`, background: allocColor(a.symbol, i) }}
                    title={`${a.label}: ${a.pct.toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {allocationBreakdown.map((a, i) => (
                  <div key={a.symbol} className="flex items-center gap-2">
                    <span
                      className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
                      style={{ background: allocColor(a.symbol, i) }}
                    />
                    <span className="flex-1 text-[12px] font-medium">{a.label}</span>
                    <span className="num text-[12px] font-semibold text-ink-2">
                      {a.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Portfolio Composition donut */}
        <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-4 text-[15px] font-bold">Portfolio Composition</div>
          {pieData.length === 0 ? (
            <div className="flex h-[130px] items-center justify-center">
              <p className="text-xs text-ink-3">No composition yet</p>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <div className="relative h-[130px] w-[130px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="100%"
                      paddingAngle={1.5}
                      stroke="none"
                      isAnimationActive
                      animationDuration={900}
                    >
                      {pieData.map((e, i) => (
                        <Cell
                          key={e.name}
                          fill={e.name === "Cash" ? CASH_COLOR : ALLOC_COLORS[i % ALLOC_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v, n) => [`Rs ${formatPKR(Number(v), { decimals: 0 })}`, String(n)]}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <div className="text-[11px] text-ink-3">Total</div>
                    <div className="num text-[14px] font-bold">
                      {formatPKR(totalValue, { compact: true })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {pieData.map((e, i) => (
                  <div key={e.name} className="flex items-center gap-2">
                    <span
                      className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
                      style={{
                        background: e.name === "Cash" ? CASH_COLOR : ALLOC_COLORS[i % ALLOC_COLORS.length],
                      }}
                    />
                    <span className="flex-1 text-[12px] font-medium">{e.name}</span>
                    <span className="num text-[12px] font-semibold text-ink-2">
                      {totalValue > 0 ? ((e.value / totalValue) * 100).toFixed(1) : "0"}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── P&L by Stock (horizontal bars) + Transaction History ── */}
      <div className="mb-[18px] grid items-start gap-[18px] lg:grid-cols-[1.2fr_1fr]">
        {/* P&L by Stock */}
        <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-4 text-[15px] font-bold">P&amp;L by Stock</div>
          {stockPnlData.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">No stocks yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stockPnlData.map((d) => {
                const up = d.pnl >= 0;
                const width = (Math.abs(d.pnl) / maxAbsPnl) * 50;
                const color = up ? "var(--color-gain)" : "var(--color-loss-strong)";
                return (
                  <div
                    key={d.symbol}
                    className="grid grid-cols-[52px_1fr_84px] items-center gap-2.5"
                  >
                    <span className="text-[12px] font-semibold">{d.symbol}</span>
                    <div className="relative flex h-[18px] justify-center">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                      <div
                        className="absolute top-[3px] h-3 rounded-[3px]"
                        style={
                          up
                            ? { left: "50%", width: `${width}%`, background: color }
                            : { right: "50%", width: `${width}%`, background: color }
                        }
                      />
                    </div>
                    <span
                      className="num text-right text-[11.5px] font-semibold"
                      style={{ color }}
                    >
                      {up ? "+" : "−"}
                      {formatPKR(Math.abs(d.pnl), { decimals: 0 })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Transaction History */}
        <section className="rounded-2xl border border-line bg-card shadow-card">
          <div className="flex items-center gap-2 px-[22px] pb-2 pt-[22px]">
            <Wallet className="h-4 w-4 text-ink-3" />
            <h2 className="text-[15px] font-bold">Transaction History</h2>
          </div>
          {model.transactions.length === 0 ? (
            <p className="px-[22px] py-8 text-center text-sm text-ink-3">
              No transactions yet.
            </p>
          ) : (
            model.transactions.map((tx) => {
              const isBuy = tx.type === "BUY";
              const isSell = tx.type === "SELL";
              const isCashIn = tx.type === "CASH_IN";
              const isCash = isCashIn || tx.type === "CASH_OUT";

              const badge = isBuy
                ? { label: "BUY", color: "#059669" }
                : isSell
                  ? { label: "SELL", color: "#E11D48" }
                  : isCashIn
                    ? { label: "CASH IN", color: "#2563EB" }
                    : { label: "CASH OUT", color: "#CA8A04" };

              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 border-t border-line-soft px-[22px] py-[11px]"
                >
                  <span
                    className="num shrink-0 rounded-md px-1.5 py-[3px] text-[10px] font-bold tracking-[.03em]"
                    style={{ color: badge.color, background: `${badge.color}1e` }}
                  >
                    {badge.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">
                      {isCash ? "Cash" : tx.symbol}
                    </div>
                    <div className="text-[11px] text-ink-3">
                      {new Date(tx.createdAt).toLocaleDateString("en-PK", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    {!isCash && (
                      <div className="num text-[12.5px] font-semibold">
                        {tx.quantity} @ {formatPKR(tx.price)}
                      </div>
                    )}
                    <div className="num text-[11px] text-ink-3">
                      Rs {formatPKR(tx.total, { decimals: 0 })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      {/* ── Stock Returns ── */}
      {stockPnlData.length > 0 && (
        <section className="mb-[18px] rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-4 text-[15px] font-bold">Stock Returns</div>
          <div className="space-y-2">
            {[...stockPnlData]
              .sort((a, b) => b.pnlPct - a.pnlPct)
              .map((stock) => {
                const up = stock.pnl >= 0;
                const color = up ? "var(--color-gain)" : "var(--color-loss-strong)";
                return (
                  <div
                    key={stock.symbol}
                    className="flex items-center gap-3 rounded-[10px] border border-line bg-card p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{stock.symbol}</p>
                      <p className="num text-[11px] text-ink-3">
                        Cost: Rs {formatPKR(stock.costBasis, { decimals: 0 })} → Value: Rs{" "}
                        {formatPKR(stock.currentValue, { decimals: 0 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num text-[13px] font-semibold" style={{ color }}>
                        {up ? "+" : "−"}Rs {formatPKR(Math.abs(stock.pnl), { decimals: 0 })}
                      </p>
                      <p className="num text-[11px]" style={{ color }}>
                        {up ? "+" : ""}
                        {stock.pnlPct.toFixed(2)}%
                      </p>
                    </div>
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-canvas">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.abs(stock.pnlPct))}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════ */}
      {/* Add Cash Dialog                    */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showAddCash} onOpenChange={setShowAddCash}>
        <DialogContent className="rounded-2xl border border-line bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <DollarSign className="h-5 w-5 text-ink-3" />
              Add Cash
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Amount (Rs)
              </label>
              <input
                type="number"
                min="0"
                value={addCashAmount}
                onChange={(e) => setAddCashAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="num w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-lg outline-none focus:border-brand"
              />
              <p className="text-[11px] text-ink-3">
                Current balance:{" "}
                <span className="num font-semibold text-ink">
                  Rs {formatPKR(model.cashBalance, { decimals: 0 })}
                </span>
              </p>
            </div>
            <button
              onClick={handleAddCash}
              disabled={addCashLoading || !addCashAmount || parseFloat(addCashAmount) <= 0}
              className="w-full rounded-[10px] bg-brand py-2.5 text-[13px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
            >
              {addCashLoading ? "Adding..." : "Add Cash"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* Withdraw Cash Dialog               */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showWithdrawCash} onOpenChange={setShowWithdrawCash}>
        <DialogContent className="rounded-2xl border border-line bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Minus className="h-5 w-5 text-ink-3" />
              Withdraw Cash
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Amount (Rs)
              </label>
              <input
                type="number"
                min="0"
                max={model.cashBalance}
                value={withdrawCashAmount}
                onChange={(e) => setWithdrawCashAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="num w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-lg outline-none focus:border-brand"
              />
              <p className="text-[11px] text-ink-3">
                Available:{" "}
                <span className="num font-semibold text-ink">
                  Rs {formatPKR(model.cashBalance, { decimals: 0 })}
                </span>
              </p>
              {parseFloat(withdrawCashAmount) > model.cashBalance && (
                <p className="text-[11px] font-semibold" style={{ color: "var(--color-loss-strong)" }}>
                  Amount exceeds available cash balance
                </p>
              )}
            </div>
            <button
              onClick={handleWithdrawCash}
              disabled={
                withdrawCashLoading ||
                !withdrawCashAmount ||
                parseFloat(withdrawCashAmount) <= 0 ||
                parseFloat(withdrawCashAmount) > model.cashBalance
              }
              className="w-full rounded-[10px] bg-brand py-2.5 text-[13px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
            >
              {withdrawCashLoading ? "Withdrawing..." : "Withdraw Cash"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* Edit Info Dialog                   */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showEditInfo} onOpenChange={setShowEditInfo}>
        <DialogContent className="rounded-2xl border border-line bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Edit Model Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Name
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-[13px] outline-none focus:border-brand"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Description
              </label>
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-[13px] outline-none focus:border-brand"
              />
            </div>
            <button
              onClick={handleEditInfo}
              disabled={!editName.trim()}
              className="w-full rounded-[10px] bg-brand py-2.5 text-[13px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* Edit Holding Dialog                */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showEditHolding} onOpenChange={setShowEditHolding}>
        <DialogContent className="rounded-2xl border border-line bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Pencil className="h-5 w-5 text-ink-3" />
              Edit {editHoldingSymbol}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[11px] text-ink-3">
              Correct the stored average (cost) price or share count for{" "}
              <span className="font-semibold text-ink">{editHoldingName}</span>. Cash
              and transaction history are not affected.
            </p>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Average Price (Rs)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editHoldingAvg}
                onChange={(e) => setEditHoldingAvg(e.target.value)}
                className="num w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-lg outline-none focus:border-brand"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Shares
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={editHoldingShares}
                onChange={(e) => setEditHoldingShares(e.target.value)}
                className="num w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-lg outline-none focus:border-brand"
              />
            </div>
            {editHoldingError && (
              <p className="text-[11px] font-semibold" style={{ color: "var(--color-loss-strong)" }}>
                {editHoldingError}
              </p>
            )}
            <button
              onClick={handleEditHoldingSubmit}
              disabled={editHoldingLoading}
              className="w-full rounded-[10px] bg-brand py-2.5 text-[13px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
            >
              {editHoldingLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* Rebalance Dialog                   */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showRebalance} onOpenChange={setShowRebalance}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <RefreshCw className="h-5 w-5 text-ink-3" />
              Rebalance Portfolio
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Add stocks search */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Add New Stock
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <input
                  value={stockQuery}
                  onChange={(e) => setStockQuery(e.target.value)}
                  placeholder="Search stocks..."
                  className="w-full rounded-[10px] border border-line bg-canvas py-2 pl-9 pr-3 text-[13px] outline-none focus:border-brand"
                />
              </div>
              {stockResults.length > 0 && (
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {stockResults.map((stock) => (
                    <button
                      key={stock.symbol}
                      className="group flex items-center justify-between rounded-[10px] border border-line bg-card px-3 py-2 text-left transition-colors hover:border-brand/40 hover:bg-ink/[.03]"
                      onClick={() => handleRebalanceAddStock(stock)}
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-semibold group-hover:text-brand">
                          {stock.symbol}
                        </span>
                        <span className="ml-2 text-[11px] text-ink-3">{stock.company}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="num text-xs">Rs {formatPKR(stock.current)}</span>
                        <Plus className="h-3.5 w-3.5 text-ink-3 group-hover:text-brand" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchLoading && stockQuery.length > 0 && (
                <p className="text-xs text-ink-3">Searching...</p>
              )}
            </div>

            {/* Allocations editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                    Allocations
                  </label>
                  <div className="flex items-center rounded-[10px] bg-canvas p-0.5">
                    <button
                      type="button"
                      onClick={() => setRebalanceMode("percent")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        rebalanceMode === "percent"
                          ? "bg-card text-ink shadow-card"
                          : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      <Percent className="h-3 w-3" />
                      Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRebalanceMode("shares");
                        // Initialize inputShares from current percentage targets
                        setRebalanceAllocations((prev) =>
                          prev.map((a) => {
                            if (a.symbol === "CASH") return a;
                            if (a.inputShares !== undefined) return a;
                            const price = marketPrices[a.symbol] || 0;
                            const targetValue = (a.percentage / 100) * totalValue;
                            const estShares = price > 0 ? Math.floor(targetValue / price) : 0;
                            return { ...a, inputShares: estShares };
                          })
                        );
                      }}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        rebalanceMode === "shares"
                          ? "bg-card text-ink shadow-card"
                          : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      <Hash className="h-3 w-3" />
                      Shares
                    </button>
                  </div>
                </div>
                <span
                  className="num text-xs font-semibold"
                  style={{
                    color:
                      Math.abs(rebalanceTotalPct - 100) < 1
                        ? "var(--color-gain)"
                        : undefined,
                  }}
                >
                  {rebalanceTotalPct.toFixed(1)}% / 100%
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex h-2 overflow-hidden rounded-full bg-canvas">
                {rebalanceAllocations
                  .filter((a) => a.percentage > 0)
                  .map((a, i) => (
                    <div
                      key={a.symbol}
                      className="h-full transition-all"
                      style={{ width: `${a.percentage}%`, background: allocColor(a.symbol, i) }}
                    />
                  ))}
              </div>

              <div className="space-y-2">
                {rebalanceAllocations.map((alloc) => {
                  // Show what will change
                  const existing = model.allocations.find(
                    (a) => a.symbol === alloc.symbol
                  );
                  const currentShares = existing?.shares || 0;
                  const price = marketPrices[alloc.symbol] || 0;
                  // Determine target shares
                  let targetShares = 0;
                  if (alloc.symbol !== "CASH") {
                    if (rebalanceMode === "shares" && alloc.inputShares != null) {
                      targetShares = alloc.inputShares;
                    } else {
                      // Percent mode: only recalculate if user changed this stock's %
                      const originalPct = existing?.percentage ?? -1;
                      const pctChanged = Math.abs(alloc.percentage - originalPct) > 0.01;
                      targetShares = pctChanged && price > 0
                        ? Math.floor(((alloc.percentage / 100) * totalValue) / price)
                        : currentShares;
                    }
                  }
                  const diff = targetShares - currentShares;

                  return (
                    <div
                      key={alloc.symbol}
                      className="flex items-center gap-3 rounded-[10px] border border-line bg-card p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {alloc.symbol === "CASH" ? "Cash Reserve" : alloc.symbol}
                        </p>
                        {alloc.symbol !== "CASH" && (
                          <p className="truncate text-[11px] text-ink-3">
                            {alloc.companyName}
                          </p>
                        )}
                        {/* Trade preview */}
                        {alloc.symbol !== "CASH" && price > 0 && (
                          <p className="mt-0.5 text-[11px]">
                            <span className="text-ink-3">
                              {currentShares} → {targetShares} shares
                            </span>
                            {diff !== 0 && (
                              <span
                                className="ml-1.5 font-semibold"
                                style={{ color: diff > 0 ? "var(--color-gain)" : "var(--color-loss-strong)" }}
                              >
                                ({diff > 0 ? "+" : ""}
                                {diff} = {diff > 0 ? "BUY" : "SELL"})
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {rebalanceMode === "percent" || alloc.symbol === "CASH" ? (
                          <>
                            <input
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
                              className="num h-8 w-20 rounded-[10px] border border-line bg-canvas text-center text-sm outline-none focus:border-brand"
                              disabled={rebalanceMode === "shares" && alloc.symbol === "CASH"}
                            />
                            <span className="text-xs font-semibold text-ink-3">%</span>
                          </>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={alloc.inputShares ?? 0}
                              onChange={(e) =>
                                handleRebalanceSharesChange(
                                  alloc.symbol,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="num h-8 w-20 rounded-[10px] border border-line bg-canvas text-center text-sm outline-none focus:border-brand"
                            />
                            <span className="text-xs font-semibold text-ink-3">shares</span>
                            <span className="num text-[11px] text-ink-3">
                              ({alloc.percentage.toFixed(1)}%)
                            </span>
                          </>
                        )}
                        {alloc.symbol !== "CASH" && (
                          <button
                            className="grid h-7 w-7 place-items-center rounded-lg text-ink-3 hover:bg-ink/[.04] hover:text-ink"
                            onClick={() => handleRebalanceRemove(alloc.symbol)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {rebalanceError && (
              <div
                className="rounded-[10px] px-3 py-2 text-sm"
                style={{ color: "var(--color-loss-strong)", background: "var(--color-loss-50)" }}
              >
                {rebalanceError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] font-medium hover:bg-ink/[.04]"
                onClick={() => setShowRebalance(false)}
              >
                Cancel
              </button>
              <button
                onClick={handleRebalanceNext}
                disabled={rebalanceLoading || Math.abs(rebalanceTotalPct - 100) > 1}
                className="flex-1 rounded-[10px] bg-brand py-2 text-[13px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
              >
                {rebalanceLoading ? "Rebalancing..." : "Review Trades"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* Rebalance Confirm Prices Dialog    */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showRebalanceConfirm} onOpenChange={setShowRebalanceConfirm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <DollarSign className="h-5 w-5 text-ink-3" />
              Confirm Trade Prices
            </DialogTitle>
          </DialogHeader>

          <p className="-mt-1 text-xs text-ink-3">
            Enter the price at which you are buying/selling each stock. Leave empty to use
            market price.
          </p>

          <div className="space-y-3 pt-2">
            {rebalanceTrades.map((trade, i) => {
              const tradePrice =
                trade.price && parseFloat(trade.price) > 0
                  ? parseFloat(trade.price)
                  : trade.marketPrice;
              const totalCost = trade.shares * tradePrice;
              const pnl =
                trade.type === "SELL"
                  ? (tradePrice - trade.avgPrice) * trade.shares
                  : 0;
              const newAvg =
                trade.type === "BUY" && trade.avgPrice > 0
                  ? (() => {
                      const existing = model.allocations.find((a) => a.symbol === trade.symbol);
                      const existingShares = existing?.shares || 0;
                      return (
                        (trade.avgPrice * existingShares + tradePrice * trade.shares) /
                        (existingShares + trade.shares)
                      );
                    })()
                  : trade.type === "BUY"
                    ? tradePrice
                    : 0;

              return (
                <div
                  key={trade.symbol}
                  className="rounded-[10px] border border-line bg-card p-3"
                >
                  {/* Header */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          color: trade.type === "SELL" ? "var(--color-loss-strong)" : "var(--color-gain)",
                          background: trade.type === "SELL" ? "var(--color-loss-50)" : "var(--color-gain-50)",
                        }}
                      >
                        {trade.type}
                      </span>
                      <span className="text-sm font-semibold">{trade.symbol}</span>
                    </div>
                    <span className="text-xs text-ink-3">{trade.shares} shares</span>
                  </div>
                  <p className="mb-2 truncate text-[11px] text-ink-3">{trade.companyName}</p>

                  {/* Price input */}
                  <div className="mb-2 flex items-center gap-2">
                    <label className="w-20 whitespace-nowrap text-xs text-ink-3">
                      {trade.type === "SELL" ? "Sell Price" : "Buy Price"}
                    </label>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-3">
                        Rs
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={formatPKR(trade.marketPrice)}
                        value={trade.price}
                        onChange={(e) => {
                          setRebalanceTrades((prev) =>
                            prev.map((t, j) =>
                              j === i ? { ...t, price: e.target.value } : t
                            )
                          );
                        }}
                        className="num h-8 w-full rounded-[10px] border border-line bg-canvas pl-9 pr-3 text-sm outline-none focus:border-brand"
                      />
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-ink-3">Market Price</span>
                      <span className="num">Rs {formatPKR(trade.marketPrice)}</span>
                    </div>
                    {trade.avgPrice > 0 && (
                      <div className="flex justify-between">
                        <span className="text-ink-3">Your Avg Price</span>
                        <span className="num">Rs {formatPKR(trade.avgPrice)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold">
                      <span className="text-ink-3">Total</span>
                      <span className="num">Rs {formatPKR(totalCost, { decimals: 0 })}</span>
                    </div>
                    {trade.type === "SELL" && trade.avgPrice > 0 && (
                      <div className="flex justify-between border-t border-line pt-1 font-semibold">
                        <span style={{ color: pnl >= 0 ? "var(--color-gain)" : "var(--color-loss-strong)" }}>
                          {pnl >= 0 ? "Profit" : "Loss"}
                        </span>
                        <span
                          className="num"
                          style={{ color: pnl >= 0 ? "var(--color-gain)" : "var(--color-loss-strong)" }}
                        >
                          {pnl >= 0 ? "+" : ""}Rs {formatPKR(pnl, { decimals: 0 })}
                          <span className="ml-1 text-[10px] opacity-70">
                            ({((tradePrice - trade.avgPrice) / trade.avgPrice * 100).toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                    )}
                    {trade.type === "BUY" && (
                      <div className="flex justify-between border-t border-line pt-1">
                        <span className="text-ink-3">New Avg Price</span>
                        <span className="num font-semibold">Rs {formatPKR(newAvg)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {rebalanceError && (
              <div
                className="rounded-[10px] px-3 py-2 text-sm"
                style={{ color: "var(--color-loss-strong)", background: "var(--color-loss-50)" }}
              >
                {rebalanceError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] font-medium hover:bg-ink/[.04]"
                onClick={() => setShowRebalanceConfirm(false)}
              >
                Back
              </button>
              <button
                onClick={() => handleRebalanceSubmit()}
                disabled={rebalanceLoading}
                className="flex-1 rounded-[10px] bg-brand py-2 text-[13px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
              >
                {rebalanceLoading ? "Executing..." : "Confirm & Execute"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* SIP Dialog                          */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showSip} onOpenChange={setShowSip}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="h-5 w-5 text-ink-3" />
              SIP — Smart Investment Plan
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-ink-3">
              Enter an amount to invest. We&apos;ll auto-distribute it across your stocks
              based on{" "}
              {sipBasis === "current"
                ? "their current weights in the portfolio"
                : "your stored target allocation"}
              . Whole shares only — any leftover stays as cash.
            </p>

            {/* Amount input */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Investment Amount (Rs)
              </label>
              <input
                type="number"
                min="0"
                value={sipAmount}
                onChange={(e) => setSipAmount(e.target.value)}
                placeholder="e.g. 30000"
                className="num w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-[13px] outline-none focus:border-brand"
                autoFocus
              />
            </div>

            {/* Basis toggle */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Distribute by
              </label>
              <div className="flex w-fit items-center rounded-[10px] bg-canvas p-0.5">
                <button
                  type="button"
                  onClick={() => setSipBasis("current")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    sipBasis === "current"
                      ? "bg-card text-ink shadow-card"
                      : "text-ink-3 hover:text-ink"
                  }`}
                >
                  Current holdings
                </button>
                <button
                  type="button"
                  onClick={() => setSipBasis("target")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    sipBasis === "target"
                      ? "bg-card text-ink shadow-card"
                      : "text-ink-3 hover:text-ink"
                  }`}
                >
                  Target allocation
                </button>
              </div>
            </div>

            {/* Plan preview */}
            {sipPlan.length > 0 && (() => {
              const amount = parseFloat(sipAmount) || 0;
              const totalCost = sipPlan.reduce(
                (sum, p) => sum + p.shares * (parseFloat(p.price) || p.marketPrice),
                0
              );
              const leftover = amount - totalCost;
              return (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                    Plan
                  </label>
                  <div className="space-y-1.5">
                    {sipPlan.map((item) => {
                      const price = parseFloat(item.price) || item.marketPrice;
                      const cost = item.shares * price;
                      return (
                        <div
                          key={item.symbol}
                          className="flex items-center gap-3 rounded-[10px] border border-line bg-card p-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{item.symbol}</p>
                            <p className="truncate text-[11px] text-ink-3">
                              {item.companyName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="num text-sm font-semibold">{item.shares} shares</p>
                            <p className="num text-[11px] text-ink-3">
                              Rs {formatPKR(cost, { decimals: 0 })} ·{" "}
                              {(item.weight * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t border-line pt-2 text-xs">
                    <span className="num text-ink-3">
                      Invested: Rs {formatPKR(totalCost, { decimals: 0 })}
                    </span>
                    <span className="text-ink-3">
                      Leftover cash:{" "}
                      <span className="num font-semibold text-ink">
                        Rs {formatPKR(leftover, { decimals: 0 })}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })()}

            {sipAmount && parseFloat(sipAmount) > 0 && sipPlan.length === 0 && (
              <div className="rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm text-ink-3">
                Amount is too small to buy even 1 share of any stock, or no stocks in
                portfolio.
              </div>
            )}

            {sipError && (
              <div
                className="rounded-[10px] px-3 py-2 text-sm"
                style={{ color: "var(--color-loss-strong)", background: "var(--color-loss-50)" }}
              >
                {sipError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] font-medium hover:bg-ink/[.04]"
                onClick={() => setShowSip(false)}
              >
                Cancel
              </button>
              <button
                onClick={handleSipNext}
                disabled={!sipAmount || parseFloat(sipAmount) <= 0 || sipPlan.length === 0}
                className="flex-1 rounded-[10px] bg-brand py-2 text-[13px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
              >
                Review & Confirm
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* SIP Confirm Prices Dialog           */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showSipConfirm} onOpenChange={setShowSipConfirm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <DollarSign className="h-5 w-5 text-ink-3" />
              Confirm Buy Prices
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-ink-3">
              Override any buy price if needed, then execute to add Rs{" "}
              {formatPKR(parseFloat(sipAmount) || 0, { decimals: 0 })} cash and buy these
              shares.
            </p>

            <div className="space-y-2">
              {sipPlan.map((item, idx) => {
                const price = parseFloat(item.price) || item.marketPrice;
                const cost = item.shares * price;
                return (
                  <div
                    key={item.symbol}
                    className="rounded-[10px] border border-line bg-card p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{item.symbol}</p>
                        <p className="text-[11px] text-ink-3">{item.companyName}</p>
                      </div>
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ color: "var(--color-gain)", background: "var(--color-gain-50)" }}
                      >
                        BUY {item.shares}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] text-ink-3">Buy @</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSipPlan((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, price: val } : p))
                            );
                          }}
                          className="num h-7 w-24 rounded-[10px] border border-line bg-canvas text-center text-xs outline-none focus:border-brand"
                        />
                      </div>
                      <span className="num text-[11px] text-ink-3">
                        Mkt: {formatPKR(item.marketPrice)}
                      </span>
                      <span className="ml-auto text-[11px] text-ink-3">
                        ={" "}
                        <span className="num font-bold text-ink">
                          Rs {formatPKR(cost, { decimals: 0 })}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {sipError && (
              <div
                className="rounded-[10px] px-3 py-2 text-sm"
                style={{ color: "var(--color-loss-strong)", background: "var(--color-loss-50)" }}
              >
                {sipError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] font-medium hover:bg-ink/[.04]"
                onClick={() => setShowSipConfirm(false)}
              >
                Back
              </button>
              <button
                onClick={handleSipSubmit}
                disabled={sipLoading}
                className="flex-1 rounded-[10px] bg-brand py-2 text-[13px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
              >
                {sipLoading ? "Executing..." : "Execute SIP"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════ */}
      {/* Bulk Trade Dialog                  */}
      {/* ═══════════════════════════════════ */}
      <Dialog open={showBulkTrade} onOpenChange={setShowBulkTrade}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ShoppingCart className="h-5 w-5 text-ink-3" />
              Bulk Trade
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Quick add from existing holdings */}
            {stockAllocations.length > 0 && (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                  Quick Sell Holdings
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {stockAllocations
                    .filter((a) => !bulkTrades.some((t) => t.symbol === a.symbol))
                    .map((a) => (
                      <button
                        key={a.symbol}
                        onClick={() => handleBulkTradeAddHolding(a)}
                        className="rounded-[10px] border border-line bg-card px-2.5 py-1 text-xs font-semibold transition-colors hover:border-brand/40 hover:bg-ink/[.03]"
                      >
                        {a.symbol} ({a.shares})
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Search to add buy */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Add Stock to Buy
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <input
                  value={stockQuery}
                  onChange={(e) => setStockQuery(e.target.value)}
                  placeholder="Search stocks..."
                  className="w-full rounded-[10px] border border-line bg-canvas py-2 pl-9 pr-3 text-[13px] outline-none focus:border-brand"
                />
              </div>
              {stockResults.length > 0 && (
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {stockResults.map((stock) => (
                    <button
                      key={stock.symbol}
                      className="group flex items-center justify-between rounded-[10px] border border-line bg-card px-3 py-2 text-left transition-colors hover:border-brand/40 hover:bg-ink/[.03]"
                      onClick={() => handleBulkTradeAddStock(stock)}
                    >
                      <div>
                        <span className="text-sm font-semibold group-hover:text-brand">
                          {stock.symbol}
                        </span>
                        <span className="ml-2 text-[11px] text-ink-3">{stock.company}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="num text-xs">Rs {formatPKR(stock.current)}</span>
                        <Plus className="h-3.5 w-3.5 text-ink-3 group-hover:text-brand" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Trade list */}
            {bulkTrades.length > 0 && (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                  Trades ({bulkTrades.length})
                </label>
                {bulkTrades.map((trade) => {
                  const price = marketPrices[trade.symbol] || 0;
                  const qty = parseInt(trade.quantity) || 0;
                  const total = qty * price;

                  return (
                    <div
                      key={trade.symbol}
                      className="flex items-center gap-3 rounded-[10px] border border-line bg-card p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{trade.symbol}</p>
                        <p className="text-[11px] text-ink-3">
                          {price > 0 ? `@ Rs ${formatPKR(price)}` : "Price unavailable"}
                          {qty > 0 && price > 0 && (
                            <span className="num ml-1.5 font-semibold text-ink">
                              = Rs {formatPKR(total, { decimals: 0 })}
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
                        className="h-8 rounded-[10px] border border-line bg-canvas px-2 text-xs font-semibold outline-none focus:border-brand"
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                      <input
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
                        className="num h-8 w-20 rounded-[10px] border border-line bg-canvas text-center text-sm outline-none focus:border-brand"
                      />
                      <button
                        onClick={() =>
                          setBulkTrades((prev) =>
                            prev.filter((t) => t.symbol !== trade.symbol)
                          )
                        }
                        className="grid h-7 w-7 place-items-center rounded-lg text-ink-3 hover:bg-ink/[.04] hover:text-ink"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cash info */}
            <p className="text-[11px] text-ink-3">
              Available cash:{" "}
              <span className="num font-semibold text-ink">
                Rs {formatPKR(model.cashBalance, { decimals: 0 })}
              </span>
            </p>

            {bulkTradeError && (
              <div
                className="rounded-[10px] px-3 py-2 text-sm"
                style={{ color: "var(--color-loss-strong)", background: "var(--color-loss-50)" }}
              >
                {bulkTradeError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] font-medium hover:bg-ink/[.04]"
                onClick={() => setShowBulkTrade(false)}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkTradeSubmit}
                disabled={
                  bulkTradeLoading ||
                  bulkTrades.filter((t) => parseInt(t.quantity) > 0).length === 0
                }
                className="flex-1 rounded-[10px] bg-brand py-2 text-[13px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
              >
                {bulkTradeLoading
                  ? "Executing..."
                  : `Execute ${bulkTrades.filter((t) => parseInt(t.quantity) > 0).length} Trade(s)`}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
