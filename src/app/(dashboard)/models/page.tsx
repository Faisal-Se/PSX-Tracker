"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Layers,
  PieChart,
  Target,
  X,
  Search,
  ArrowRight,
  Wallet,
  Hash,
  Percent,
} from "lucide-react";
import { formatPKR } from "@/lib/market-status";
import { PageSkeleton } from "@/components/ui/skeleton";

interface Allocation {
  id?: string;
  symbol: string;
  companyName: string;
  percentage: number;
  shares: number;
  avgPrice: number;
}

interface ModelPortfolio {
  id: string;
  name: string;
  description: string;
  cashBalance: number;
  allocations: Allocation[];
  createdAt: string;
}

interface SearchStock {
  symbol: string;
  company: string;
  current: number;
}

export default function ModelsPage() {
  const router = useRouter();
  const [models, setModels] = useState<ModelPortfolio[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  // Editor form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCash, setFormCash] = useState("");
  const [allocations, setAllocations] = useState<
    { symbol: string; companyName: string; percentage: number; customPrice?: number; inputShares?: number }[]
  >([{ symbol: "CASH", companyName: "Cash Reserve", percentage: 100 }]);

  // Stock search
  const [stockQuery, setStockQuery] = useState("");
  const [stockResults, setStockResults] = useState<SearchStock[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Market prices for preview
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});

  // Raw string values for buy price inputs (so user can clear/type freely)
  const [customPriceInputs, setCustomPriceInputs] = useState<Record<string, string>>({});

  // Allocation mode: percent or shares
  const [allocMode, setAllocMode] = useState<"percent" | "shares">("percent");

  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/model-portfolios");
      if (res.ok) setModels(await res.json());
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced stock search
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
          const existing = new Set(allocations.map((a) => a.symbol));
          setStockResults(
            data
              .filter((s: SearchStock) => !existing.has(s.symbol))
              .slice(0, 8)
          );
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [stockQuery, allocations]);

  const totalPct = allocations.reduce((sum, a) => sum + a.percentage, 0);
  const cashAmount = parseFloat(formCash) || 0;

  const handleAddStock = (stock: SearchStock) => {
    if (allocations.some((a) => a.symbol === stock.symbol)) return;

    const defaultPct = Math.min(
      10,
      100 -
        totalPct +
        (allocations.find((a) => a.symbol === "CASH")?.percentage || 0)
    );

    setAllocations((prev) => {
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
      // In shares mode, compute initial shares from the default percentage
      if (allocMode === "shares" && cashAmount > 0 && stock.current > 0) {
        const allocAmount = (defaultPct / 100) * cashAmount;
        newAlloc.inputShares = Math.floor(allocAmount / stock.current);
      }
      return [...updated, newAlloc];
    });

    setMarketPrices((prev) => ({ ...prev, [stock.symbol]: stock.current }));
    setCustomPriceInputs((prev) => ({ ...prev, [stock.symbol]: stock.current > 0 ? String(stock.current) : "" }));
    setStockQuery("");
    setStockResults([]);
  };

  const handleRemoveAlloc = (symbol: string) => {
    if (symbol === "CASH") return;
    const removing = allocations.find((a) => a.symbol === symbol);
    if (!removing) return;

    setAllocations((prev) =>
      prev
        .filter((a) => a.symbol !== symbol)
        .map((a) =>
          a.symbol === "CASH"
            ? { ...a, percentage: a.percentage + removing.percentage }
            : a
        )
    );
  };

  const handlePctChange = (symbol: string, newPct: number) => {
    const oldAlloc = allocations.find((a) => a.symbol === symbol);
    if (!oldAlloc) return;
    const diff = newPct - oldAlloc.percentage;

    setAllocations((prev) =>
      prev.map((a) => {
        if (a.symbol === symbol) return { ...a, percentage: newPct };
        if (a.symbol === "CASH" && symbol !== "CASH")
          return { ...a, percentage: Math.max(0, a.percentage - diff) };
        return a;
      })
    );
  };

  // In shares mode: update shares count and recalc only the changed stock's % + CASH
  const handleSharesChange = (symbol: string, newShares: number) => {
    setAllocations((prev) => {
      if (cashAmount <= 0) {
        return prev.map((a) =>
          a.symbol === symbol ? { ...a, inputShares: newShares } : a
        );
      }

      // Calculate new percentage for the changed stock
      const alloc = prev.find((a) => a.symbol === symbol);
      const price = alloc?.customPrice || marketPrices[symbol] || 0;
      const newPct = price > 0 ? Math.round((newShares * price / cashAmount) * 1000) / 10 : 0;

      // Adjust only this stock and CASH
      const oldPct = alloc?.percentage ?? 0;
      const diff = newPct - oldPct;

      return prev.map((a) => {
        if (a.symbol === symbol) return { ...a, inputShares: newShares, percentage: newPct };
        if (a.symbol === "CASH") return { ...a, percentage: Math.max(0, Math.round((a.percentage - diff) * 10) / 10) };
        return a;
      });
    });
  };

  // Recalc all percentages when cash amount changes in shares mode
  useEffect(() => {
    if (allocMode !== "shares" || cashAmount <= 0) return;
    setAllocations((prev) => {
      let usedPct = 0;
      const recalced = prev.map((a) => {
        if (a.symbol === "CASH") return a;
        const price = a.customPrice || marketPrices[a.symbol] || 0;
        const shares = a.inputShares ?? 0;
        const cost = shares * price;
        const pct = Math.round((cost / cashAmount) * 1000) / 10;
        usedPct += pct;
        return { ...a, percentage: pct };
      });
      return recalced.map((a) =>
        a.symbol === "CASH" ? { ...a, percentage: Math.max(0, Math.round((100 - usedPct) * 10) / 10) } : a
      );
    });
  // Only recalc when cash amount changes — individual stock changes handled by handleSharesChange
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashAmount, allocMode]);

  const openCreateEditor = () => {
    setFormName("");
    setFormDescription("");
    setFormCash("");
    setAllocations([
      { symbol: "CASH", companyName: "Cash Reserve", percentage: 100 },
    ]);
    setStockQuery("");
    setStockResults([]);
    setMarketPrices({});
    setCustomPriceInputs({});
    setAllocMode("percent");
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (
      !formName.trim() ||
      Math.abs(totalPct - 100) > 1 ||
      cashAmount <= 0
    )
      return;
    setSaving(true);

    try {
      const res = await fetch("/api/model-portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription,
          cashBalance: cashAmount,
          allocations: allocations.map((a) => ({
            symbol: a.symbol,
            companyName: a.companyName,
            percentage: a.percentage,
            customPrice: a.customPrice,
            ...(allocMode === "shares" && a.inputShares != null ? { exactShares: a.inputShares } : {}),
          })),
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setShowEditor(false);
        router.push(`/models/${created.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this model portfolio?")) return;
    const res = await fetch(`/api/model-portfolios/${id}`, {
      method: "DELETE",
    });
    if (res.ok) fetchData();
  };

  if (initialLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between animate-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Model Portfolios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Self-contained investment accounts with their own cash and holdings
          </p>
        </div>
        <Button
          onClick={openCreateEditor}
          className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Model
        </Button>
      </div>

      {/* Model Portfolio Cards */}
      {!loading && models.length === 0 && !showEditor ? (
        <Card className="border border-border bg-card rounded-xl animate-in-up-delay-1">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl border border-border bg-muted/40 flex items-center justify-center mb-4">
              <Layers className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-2">
              No model portfolios yet
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Create a model portfolio with starting cash. Pick stocks, set
              percentages, and shares are auto-purchased at market price.
            </p>
            <Button
              onClick={openCreateEditor}
              className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Model
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-in-up-delay-1">
          {models.map((model) => {
            const stockCount = model.allocations.filter(
              (a) => a.symbol !== "CASH" && a.shares > 0
            ).length;

            return (
              <Card
                key={model.id}
                className="border border-border bg-card rounded-xl cursor-pointer transition-colors hover:border-primary/40"
                onClick={() => router.push(`/models/${model.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg border border-border bg-muted/40 flex items-center justify-center">
                          <PieChart className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        {model.name}
                      </CardTitle>
                      {model.description && (
                        <p className="text-xs text-muted-foreground mt-1 ml-9">
                          {model.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => handleDelete(e, model.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Allocation Bars */}
                  <div className="space-y-2">
                    {model.allocations.map((alloc) => {
                      const isCash = alloc.symbol === "CASH";
                      return (
                        <div key={alloc.symbol} className="group">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium">
                              {isCash ? "Cash" : alloc.symbol}
                              {!isCash && alloc.shares > 0 && (
                                <span className="text-muted-foreground font-normal ml-1.5">
                                  {alloc.shares} shares
                                </span>
                              )}
                            </span>
                            <span className="font-tabular font-semibold">
                              {alloc.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isCash ? "bg-muted-foreground/40" : "bg-primary"
                              }`}
                              style={{ width: `${alloc.percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5" />
                        <span className="font-tabular font-semibold text-foreground">
                          PKR {formatPKR(model.cashBalance, { decimals: 0 })}
                        </span>
                      </span>
                      <span>
                        <span className="font-tabular font-semibold text-foreground">
                          {stockCount}
                        </span>{" "}
                        stocks
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                      View
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════ */}
      {/* Create Model Editor                */}
      {/* ═══════════════════════════════════ */}
      {showEditor && (
        <Card className="border border-border bg-card rounded-xl animate-scale-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <div className="h-7 w-7 rounded-lg border border-border bg-muted/40 flex items-center justify-center">
                  <Target className="h-4 w-4 text-muted-foreground" />
                </div>
                Create Model Portfolio
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setShowEditor(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Name, Description, Cash */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Model Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Blue Chip Mix"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Description (optional)
                </Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Strategy description"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Starting Cash (PKR)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formCash}
                  onChange={(e) => setFormCash(e.target.value)}
                  placeholder="e.g. 100000"
                  className="rounded-lg font-tabular"
                />
              </div>
            </div>

            {/* Stock Search */}
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add Stocks</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={stockQuery}
                  onChange={(e) => setStockQuery(e.target.value)}
                  placeholder="Search stocks to add..."
                  className="pl-9 rounded-lg"
                />
              </div>
              {stockResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {stockResults.map((stock) => (
                    <button
                      key={stock.symbol}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-card hover:bg-muted/50 border border-border hover:border-primary/40 transition-colors text-left group"
                      onClick={() => handleAddStock(stock)}
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                          {stock.symbol}
                        </span>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {stock.company}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-xs font-tabular font-semibold">
                          PKR {formatPKR(stock.current)}
                        </p>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary ml-auto" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchLoading && stockQuery.length > 0 && (
                <p className="text-xs text-muted-foreground">Searching...</p>
              )}
            </div>

            {/* Allocations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Allocations</Label>
                  <div className="flex items-center bg-muted rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setAllocMode("percent")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        allocMode === "percent"
                          ? "bg-background text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Percent className="h-3 w-3" />
                      Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAllocMode("shares");
                        // Initialize inputShares from current percentage estimates
                        if (cashAmount > 0) {
                          setAllocations((prev) =>
                            prev.map((a) => {
                              if (a.symbol === "CASH") return a;
                              const price = a.customPrice || marketPrices[a.symbol] || 0;
                              const allocAmount = (a.percentage / 100) * cashAmount;
                              const estShares = price > 0 ? Math.floor(allocAmount / price) : 0;
                              return { ...a, inputShares: estShares };
                            })
                          );
                        }
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        allocMode === "shares"
                          ? "bg-background text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Hash className="h-3 w-3" />
                      Shares
                    </button>
                  </div>
                </div>
                <span
                  className="text-xs font-semibold font-tabular"
                  style={{
                    color:
                      Math.abs(totalPct - 100) < 1
                        ? "var(--color-profit)"
                        : undefined,
                  }}
                >
                  {totalPct.toFixed(1)}% / 100%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                {allocations
                  .filter((a) => a.percentage > 0)
                  .map((a) => (
                    <div
                      key={a.symbol}
                      className={`h-full transition-all ${
                        a.symbol === "CASH" ? "bg-muted-foreground/40" : "bg-primary"
                      }`}
                      style={{
                        width: `${a.percentage}%`,
                        opacity: a.symbol === "CASH" ? 1 : undefined,
                      }}
                      title={`${a.symbol}: ${a.percentage}%`}
                    />
                  ))}
              </div>

              <div className="space-y-2">
                {allocations.map((alloc) => {
                  const mktPrice = marketPrices[alloc.symbol] || 0;
                  const usePrice = alloc.customPrice || mktPrice;
                  const allocAmount = (alloc.percentage / 100) * cashAmount;
                  const estShares =
                    alloc.symbol !== "CASH" && usePrice > 0
                      ? Math.floor(allocAmount / usePrice)
                      : 0;
                  const estCost = estShares * usePrice;

                  return (
                    <div
                      key={alloc.symbol}
                      className="p-3 rounded-lg bg-card border border-border"
                    >
                      <div className="flex items-center gap-3">
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
                        </div>
                        <div className="flex items-center gap-2">
                          {allocMode === "percent" || alloc.symbol === "CASH" ? (
                            <>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={alloc.percentage}
                                onChange={(e) =>
                                  handlePctChange(
                                    alloc.symbol,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-20 h-8 rounded-lg font-tabular text-center text-sm"
                                disabled={allocMode === "shares" && alloc.symbol === "CASH"}
                              />
                              <span className="text-xs text-muted-foreground font-semibold">
                                %
                              </span>
                            </>
                          ) : (
                            <>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={alloc.inputShares ?? 0}
                                onChange={(e) =>
                                  handleSharesChange(
                                    alloc.symbol,
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="w-20 h-8 rounded-lg font-tabular text-center text-sm"
                              />
                              <span className="text-xs text-muted-foreground font-semibold">
                                shares
                              </span>
                              <span className="text-[11px] text-muted-foreground font-tabular">
                                ({alloc.percentage.toFixed(1)}%)
                              </span>
                            </>
                          )}
                          {alloc.symbol !== "CASH" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => handleRemoveAlloc(alloc.symbol)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Price & shares row for stocks */}
                      {alloc.symbol !== "CASH" && (
                        <div className="flex items-center gap-3 mt-2 pl-0">
                          <div className="flex items-center gap-1.5">
                            <Label className="text-[11px] text-muted-foreground whitespace-nowrap">
                              Buy @
                            </Label>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={customPriceInputs[alloc.symbol] ?? (mktPrice > 0 ? String(mktPrice) : "")}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setCustomPriceInputs((prev) => ({ ...prev, [alloc.symbol]: raw }));
                                const val = raw === "" ? undefined : parseFloat(raw);
                                setAllocations((prev) => {
                                  const updated = prev.map((a) =>
                                    a.symbol === alloc.symbol ? { ...a, customPrice: val } : a
                                  );
                                  // Recalc % in shares mode
                                  if (allocMode === "shares" && cashAmount > 0) {
                                    const thisAlloc = updated.find((a) => a.symbol === alloc.symbol);
                                    const shares = thisAlloc?.inputShares ?? 0;
                                    const effectivePrice = (val != null && val > 0) ? val : mktPrice;
                                    const newPct = effectivePrice > 0 ? Math.round((shares * effectivePrice / cashAmount) * 1000) / 10 : 0;
                                    const oldPct = thisAlloc?.percentage ?? 0;
                                    const diff = newPct - oldPct;
                                    return updated.map((a) => {
                                      if (a.symbol === alloc.symbol) return { ...a, percentage: newPct };
                                      if (a.symbol === "CASH") return { ...a, percentage: Math.max(0, Math.round((a.percentage - diff) * 10) / 10) };
                                      return a;
                                    });
                                  }
                                  return updated;
                                });
                              }}
                              className="w-24 h-7 rounded-lg font-tabular text-center text-xs"
                            />
                          </div>
                          {mktPrice > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              Mkt: {formatPKR(mktPrice)}
                            </span>
                          )}
                          {allocMode === "shares" ? (
                            usePrice > 0 && (alloc.inputShares ?? 0) > 0 && (
                              <span className="text-[11px] text-muted-foreground ml-auto">
                                = PKR{" "}
                                <span className="font-semibold text-foreground">
                                  {formatPKR((alloc.inputShares ?? 0) * usePrice, { decimals: 0 })}
                                </span>
                              </span>
                            )
                          ) : (
                            usePrice > 0 && cashAmount > 0 && (
                              <span className="text-[11px] text-muted-foreground ml-auto">
                                <span className="font-semibold text-foreground">
                                  {estShares} shares
                                </span>{" "}
                                = PKR {formatPKR(estCost, { decimals: 0 })}
                              </span>
                            )
                          )}
                        </div>
                      )}

                      {/* Cash info */}
                      {alloc.symbol === "CASH" && cashAmount > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          PKR {formatPKR(allocAmount, { decimals: 0 })} reserved
                          {allocMode === "shares" && (
                            <span className="ml-1">({alloc.percentage.toFixed(1)}%)</span>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => setShowEditor(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  !formName.trim() ||
                  Math.abs(totalPct - 100) > 1 ||
                  cashAmount <= 0
                }
                className="flex-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? "Creating..." : allocMode === "shares" ? "Create & Buy Shares" : "Create & Buy Stocks"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
