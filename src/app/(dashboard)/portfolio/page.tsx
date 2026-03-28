"use client";

import { useEffect, useState, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Settings,
  Trash2,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  PackageOpen,
  CircleDollarSign,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { TradeDialog } from "@/components/TradeDialog";
import { StockSearch } from "@/components/StockSearch";
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
  type: string;
  cashBalance: number;
  holdings: Holding[];
  _count: { transactions: number };
}

interface MarketStock {
  symbol: string;
  company: string;
  current: number;
  change: number;
  changePercent: number;
}

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [marketData, setMarketData] = useState<Map<string, MarketStock>>(
    new Map()
  );
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Personal");
  const [newCash, setNewCash] = useState("1000000");
  const [activeTab, setActiveTab] = useState<string>("");
  const [tradeStock, setTradeStock] = useState<{
    symbol: string;
    company: string;
    price: number;
    portfolioId?: string;
  } | null>(null);

  // Edit portfolio state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [addCashAmount, setAddCashAmount] = useState("");
  const [removeCashAmount, setRemoveCashAmount] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [portfolioRes, marketRes] = await Promise.all([
      fetch("/api/portfolios"),
      fetch("/api/psx"),
    ]);

    if (portfolioRes.ok) {
      const data = await portfolioRes.json();
      setPortfolios(data);
      if (!activeTab && data.length > 0) {
        setActiveTab(data[0].id);
      }
    }
    if (marketRes.ok) {
      const data = await marketRes.json();
      const map = new Map<string, MarketStock>();
      if (Array.isArray(data)) {
        data.forEach((s: MarketStock) => map.set(s.symbol, s));
      }
      setMarketData(map);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreatePortfolio = async () => {
    const res = await fetch("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        type: newType,
        cashBalance: parseFloat(newCash),
      }),
    });
    if (res.ok) {
      const newPortfolio = await res.json();
      setShowCreate(false);
      setNewName("");
      setNewCash("1000000");
      setActiveTab(newPortfolio.id);
      fetchData();
    }
  };

  const activePortfolio = portfolios.find((p) => p.id === activeTab);

  const openEditDialog = () => {
    if (!activePortfolio) return;
    setEditName(activePortfolio.name);
    setEditType(activePortfolio.type);
    setAddCashAmount("");
    setRemoveCashAmount("");
    setShowEdit(true);
  };

  const handleEditPortfolio = async () => {
    if (!activePortfolio) return;
    setEditLoading(true);

    const payload: Record<string, unknown> = {};
    if (editName && editName !== activePortfolio.name) payload.name = editName;
    if (editType && editType !== activePortfolio.type) payload.type = editType;
    if (addCashAmount && parseFloat(addCashAmount) > 0)
      payload.addCash = parseFloat(addCashAmount);
    if (removeCashAmount && parseFloat(removeCashAmount) > 0)
      payload.removeCash = parseFloat(removeCashAmount);

    if (Object.keys(payload).length > 0) {
      await fetch(`/api/portfolios/${activePortfolio.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setEditLoading(false);
    setShowEdit(false);
    fetchData();
  };

  const handleDeletePortfolio = async () => {
    if (!activePortfolio) return;
    if (
      !confirm(
        `Are you sure you want to delete "${activePortfolio.name}"? This action cannot be undone.`
      )
    )
      return;

    setEditLoading(true);
    const res = await fetch(`/api/portfolios/${activePortfolio.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setShowEdit(false);
      setEditLoading(false);
      const remaining = portfolios.filter((p) => p.id !== activePortfolio.id);
      setActiveTab(remaining.length > 0 ? remaining[0].id : "");
      fetchData();
    } else {
      setEditLoading(false);
    }
  };

  const typeColors: Record<string, string> = {
    Personal: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    Trading: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    Family: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    Business: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your investment portfolios and track performance
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="rounded-xl shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Portfolio
        </Button>
      </div>

      {portfolios.length === 0 ? (
        <Card className="stat-card rounded-xl shadow-sm border">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No portfolios yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              Create your first portfolio to start tracking investments, managing
              cash, and monitoring your returns.
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              className="rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Portfolio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => v && setActiveTab(v)}>
          <div className="flex items-center gap-3">
            <TabsList className="rounded-xl">
              {portfolios.map((p) => (
                <TabsTrigger
                  key={p.id}
                  value={p.id}
                  className="rounded-lg"
                >
                  {p.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {activePortfolio && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl h-9 w-9 shadow-sm"
                onClick={openEditDialog}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>

          {portfolios.map((portfolio) => {
            const totalInvested = portfolio.holdings.reduce(
              (sum, h) => sum + h.avgPrice * h.quantity,
              0
            );
            const totalCurrent = portfolio.holdings.reduce((sum, h) => {
              const stock = marketData.get(h.symbol);
              const price = stock?.current || h.avgPrice;
              return sum + price * h.quantity;
            }, 0);
            const pnl = totalCurrent - totalInvested;
            const pnlPercent =
              totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
            const totalValue = portfolio.cashBalance + totalCurrent;

            return (
              <TabsContent key={portfolio.id} value={portfolio.id}>
                <div className="space-y-5">
                  {/* Portfolio Type Badge */}
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`rounded-lg px-3 py-1 text-xs font-medium ${
                        typeColors[portfolio.type] || ""
                      }`}
                    >
                      {portfolio.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {portfolio._count.transactions} transactions
                    </span>
                  </div>

                  {/* Stat Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card className="stat-card rounded-xl shadow-sm border">
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Total Value
                          </p>
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <PieChart className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                        <p className="text-xl font-bold font-tabular">
                          {formatPKR(totalValue, { decimals: 0 })}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Cash + Holdings
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="stat-card rounded-xl shadow-sm border">
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Cash Balance
                          </p>
                          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Wallet className="h-4 w-4 text-blue-500" />
                          </div>
                        </div>
                        <p className="text-xl font-bold font-tabular">
                          {formatPKR(portfolio.cashBalance, { decimals: 0 })}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Available to invest
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="stat-card rounded-xl shadow-sm border">
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Invested
                          </p>
                          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <BarChart3 className="h-4 w-4 text-amber-500" />
                          </div>
                        </div>
                        <p className="text-xl font-bold font-tabular">
                          {formatPKR(totalInvested, { decimals: 0 })}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Cost basis
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="stat-card rounded-xl shadow-sm border">
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Market Value
                          </p>
                          <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                            <CircleDollarSign className="h-4 w-4 text-cyan-500" />
                          </div>
                        </div>
                        <p className="text-xl font-bold font-tabular">
                          {formatPKR(totalCurrent, { decimals: 0 })}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Current holdings value
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="stat-card rounded-xl shadow-sm border">
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            P&L
                          </p>
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                              pnl >= 0
                                ? "bg-emerald-500/10"
                                : "bg-red-500/10"
                            }`}
                          >
                            {pnl >= 0 ? (
                              <TrendingUp className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </div>
                        <p
                          className={`text-xl font-bold font-tabular ${
                            pnl >= 0
                              ? "text-[var(--color-profit)]"
                              : "text-[var(--color-loss)]"
                          }`}
                        >
                          {pnl >= 0 ? "+" : ""}
                          {formatPKR(pnl, { decimals: 0 })}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          <span
                            className={
                              pnlPercent >= 0
                                ? "text-[var(--color-profit)]"
                                : "text-[var(--color-loss)]"
                            }
                          >
                            {pnlPercent >= 0 ? "+" : ""}
                            {pnlPercent.toFixed(2)}%
                          </span>{" "}
                          return
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quick Trade */}
                  <Card className="stat-card rounded-xl shadow-sm border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                        Quick Trade
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <StockSearch
                        onSelect={(stock) =>
                          setTradeStock({
                            symbol: stock.symbol,
                            company: stock.company,
                            price: stock.current,
                          })
                        }
                        placeholder="Search a stock to buy or sell..."
                      />
                    </CardContent>
                  </Card>

                  {/* Holdings Table */}
                  <Card className="stat-card rounded-xl shadow-sm border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">
                          Holdings
                        </CardTitle>
                        {portfolio.holdings.length > 0 && (
                          <Badge
                            variant="secondary"
                            className="rounded-lg text-xs"
                          >
                            {portfolio.holdings.length} stock
                            {portfolio.holdings.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {portfolio.holdings.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="mx-auto w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                            <PackageOpen className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            No holdings yet
                          </p>
                          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                            Use the Quick Trade section above to search and buy
                            your first stock in this portfolio.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Stock
                                </th>
                                <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Qty
                                </th>
                                <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Avg Price
                                </th>
                                <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Current
                                </th>
                                <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Value
                                </th>
                                <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  P&L
                                </th>
                                <th className="text-right py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {portfolio.holdings.map((h) => {
                                const stock = marketData.get(h.symbol);
                                const currentPrice =
                                  stock?.current || h.avgPrice;
                                const value = currentPrice * h.quantity;
                                const holdingPnl =
                                  (currentPrice - h.avgPrice) * h.quantity;
                                const holdingPnlPercent =
                                  h.avgPrice > 0
                                    ? ((currentPrice - h.avgPrice) /
                                        h.avgPrice) *
                                      100
                                    : 0;

                                return (
                                  <tr
                                    key={h.id}
                                    className="table-row-hover border-b last:border-0 transition-colors"
                                  >
                                    <td className="py-3 px-2">
                                      <Link
                                        href={`/stock/${h.symbol}`}
                                        className="group"
                                      >
                                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                          {h.symbol}
                                        </span>
                                        <br />
                                        <span className="text-xs text-muted-foreground line-clamp-1">
                                          {h.companyName}
                                        </span>
                                      </Link>
                                    </td>
                                    <td className="text-right py-3 px-2 font-tabular font-medium">
                                      {h.quantity.toLocaleString()}
                                    </td>
                                    <td className="text-right py-3 px-2 font-tabular text-muted-foreground">
                                      {formatPKR(h.avgPrice)}
                                    </td>
                                    <td className="text-right py-3 px-2 font-tabular font-medium">
                                      {formatPKR(currentPrice)}
                                    </td>
                                    <td className="text-right py-3 px-2 font-tabular font-semibold">
                                      {formatPKR(value, { decimals: 0 })}
                                    </td>
                                    <td className="text-right py-3 px-2">
                                      <div
                                        className={`font-tabular font-medium ${
                                          holdingPnl >= 0
                                            ? "text-[var(--color-profit)]"
                                            : "text-[var(--color-loss)]"
                                        }`}
                                      >
                                        <span className="flex items-center justify-end gap-1">
                                          {holdingPnl >= 0 ? (
                                            <ArrowUpRight className="h-3 w-3" />
                                          ) : (
                                            <ArrowDownRight className="h-3 w-3" />
                                          )}
                                          {formatPKR(Math.abs(holdingPnl), {
                                            decimals: 0,
                                          })}
                                        </span>
                                        <span className="text-xs opacity-80">
                                          {holdingPnlPercent >= 0 ? "+" : ""}
                                          {holdingPnlPercent.toFixed(2)}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="text-right py-3 px-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-7 rounded-lg shadow-sm"
                                        onClick={() =>
                                          setTradeStock({
                                            symbol: h.symbol,
                                            company: h.companyName,
                                            price: currentPrice,
                                            portfolioId: portfolio.id,
                                          })
                                        }
                                      >
                                        Trade
                                      </Button>
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
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Create Portfolio Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Create New Portfolio
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Portfolio Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. My Trading Portfolio"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Type</Label>
              <Select
                value={newType}
                onValueChange={(v) => v && setNewType(v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Trading">Trading</SelectItem>
                  <SelectItem value="Family">Family</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Starting Cash (PKR)</Label>
              <Input
                type="number"
                value={newCash}
                onChange={(e) => setNewCash(e.target.value)}
                className="rounded-xl font-tabular"
              />
            </div>
            <Button
              onClick={handleCreatePortfolio}
              className="w-full rounded-xl"
              disabled={!newName.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Portfolio
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Portfolio Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit Portfolio
            </DialogTitle>
          </DialogHeader>
          {activePortfolio && (
            <div className="space-y-5 pt-2">
              {/* Rename */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Portfolio Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Portfolio name"
                  className="rounded-xl"
                />
              </div>

              {/* Change Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <Select
                  value={editType}
                  onValueChange={(v) => v && setEditType(v)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Personal">Personal</SelectItem>
                    <SelectItem value="Trading">Trading</SelectItem>
                    <SelectItem value="Family">Family</SelectItem>
                    <SelectItem value="Business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Cash Management */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Cash Management</p>
                <p className="text-xs text-muted-foreground">
                  Current balance:{" "}
                  <span className="font-tabular font-semibold text-foreground">
                    PKR {formatPKR(activePortfolio.cashBalance, { decimals: 0 })}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Add Cash
                    </Label>
                    <Input
                      type="number"
                      value={addCashAmount}
                      onChange={(e) => setAddCashAmount(e.target.value)}
                      placeholder="0"
                      className="rounded-xl font-tabular"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Remove Cash
                    </Label>
                    <Input
                      type="number"
                      value={removeCashAmount}
                      onChange={(e) => setRemoveCashAmount(e.target.value)}
                      placeholder="0"
                      className="rounded-xl font-tabular"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleEditPortfolio}
                className="w-full rounded-xl"
                disabled={editLoading}
              >
                {editLoading ? "Saving..." : "Save Changes"}
              </Button>

              <Separator />

              {/* Danger Zone */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-destructive uppercase tracking-wide">
                  Danger Zone
                </p>
                <Button
                  variant="destructive"
                  className="w-full rounded-xl"
                  onClick={handleDeletePortfolio}
                  disabled={editLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Portfolio
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Trade Dialog */}
      {tradeStock && (
        <TradeDialog
          open={!!tradeStock}
          onOpenChange={(open) => !open && setTradeStock(null)}
          symbol={tradeStock.symbol}
          companyName={tradeStock.company}
          currentPrice={tradeStock.price}
          portfolios={portfolios.map((p) => ({
            id: p.id,
            name: p.name,
            cashBalance: p.cashBalance,
          }))}
          defaultPortfolioId={tradeStock.portfolioId || activeTab}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
