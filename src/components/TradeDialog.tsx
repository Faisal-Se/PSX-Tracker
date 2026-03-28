"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";
import { formatPKR } from "@/lib/market-status";

interface Portfolio {
  id: string;
  name: string;
  cashBalance: number;
}

interface Holding {
  symbol: string;
  quantity: number;
  avgPrice: number;
}

interface TradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  companyName: string;
  currentPrice: number;
  portfolios: Portfolio[];
  onSuccess: () => void;
  defaultType?: "BUY" | "SELL";
  defaultPortfolioId?: string;
}

export function TradeDialog({
  open,
  onOpenChange,
  symbol,
  companyName,
  currentPrice,
  portfolios,
  onSuccess,
  defaultType = "BUY",
  defaultPortfolioId,
}: TradeDialogProps) {
  const [type, setType] = useState<"BUY" | "SELL">(defaultType);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [portfolioId, setPortfolioId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [holdings, setHoldings] = useState<Holding[]>([]);

  // Fetch holdings for selected portfolio to validate sell
  const fetchHoldings = useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/portfolios/${pid}`);
      if (res.ok) {
        const data = await res.json();
        setHoldings(data.holdings || []);
      }
    } catch {
      setHoldings([]);
    }
  }, []);

  // Reset form when dialog opens or stock changes
  useEffect(() => {
    if (open) {
      setType(defaultType);
      setQuantity("");
      setPrice(currentPrice > 0 ? currentPrice.toString() : "");
      const pid = defaultPortfolioId || portfolios[0]?.id || "";
      setPortfolioId(pid);
      setError("");
      setLoading(false);
      if (pid) fetchHoldings(pid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, symbol]);

  // Re-fetch holdings when portfolio changes
  useEffect(() => {
    if (portfolioId) fetchHoldings(portfolioId);
  }, [portfolioId, fetchHoldings]);

  const total = (parseInt(quantity) || 0) * (parseFloat(price) || 0);
  const selectedPortfolio = portfolios.find((p) => p.id === portfolioId);
  const currentHolding = holdings.find((h) => h.symbol === symbol);
  const ownedQty = currentHolding?.quantity || 0;
  const avgBuyPrice = currentHolding?.avgPrice || 0;
  const sellQty = parseInt(quantity) || 0;

  const handleSubmit = async () => {
    if (!portfolioId || !quantity || !price) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          symbol,
          companyName,
          quantity: parseInt(quantity),
          price: parseFloat(price),
          portfolioId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Transaction failed");
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch {
      setError("Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  const canSell = type === "SELL" && ownedQty > 0;
  const cantSellReason =
    type === "SELL" && ownedQty === 0
      ? "You don't own this stock in this portfolio"
      : type === "SELL" && sellQty > ownedQty
        ? `You only own ${ownedQty} shares`
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "BUY" ? (
              <ArrowUpRight className="h-5 w-5 text-emerald-500" />
            ) : (
              <ArrowDownRight className="h-5 w-5 text-red-500" />
            )}
            {type} {symbol}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{companyName}</p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Buy / Sell Toggle */}
          <div className="flex gap-2">
            <Button
              variant={type === "BUY" ? "default" : "outline"}
              className={`flex-1 rounded-xl font-semibold ${
                type === "BUY"
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : ""
              }`}
              onClick={() => { setType("BUY"); setQuantity(""); setError(""); }}
            >
              Buy
            </Button>
            <Button
              variant={type === "SELL" ? "default" : "outline"}
              className={`flex-1 rounded-xl font-semibold ${
                type === "SELL"
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : ""
              }`}
              onClick={() => { setType("SELL"); setQuantity(""); setError(""); }}
            >
              Sell
            </Button>
          </div>

          {/* Portfolio Select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Portfolio</Label>
            <Select
              value={portfolioId}
              onValueChange={(v) => v && setPortfolioId(v)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select portfolio">
                  {(value: string | null) => {
                    if (!value) return "Select portfolio";
                    const p = portfolios.find((p) => p.id === value);
                    return p ? `${p.name} (PKR ${formatPKR(p.cashBalance, { decimals: 0 })})` : value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {portfolios.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (PKR {formatPKR(p.cashBalance, { decimals: 0 })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sell: Show owned shares info */}
          {type === "SELL" && (
            <div className={`p-3 rounded-xl text-sm ${
              ownedQty > 0
                ? "bg-amber-500/10 border border-amber-500/20"
                : "bg-red-500/10 border border-red-500/20"
            }`}>
              {ownedQty > 0 ? (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">You own</span>
                    <span className="font-bold font-tabular">{ownedQty} shares</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg buy price</span>
                    <span className="font-tabular">PKR {formatPKR(avgBuyPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current value</span>
                    <span className="font-tabular font-semibold">PKR {formatPKR(ownedQty * currentPrice, { decimals: 0 })}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">You don&apos;t own {symbol} in this portfolio</span>
                </div>
              )}
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Quantity (shares)</Label>
              {type === "SELL" && ownedQty > 0 && (
                <button
                  className="text-[11px] font-semibold text-red-500 hover:text-red-600 transition-colors"
                  onClick={() => setQuantity(ownedQty.toString())}
                >
                  Sell All ({ownedQty})
                </button>
              )}
            </div>
            <Input
              type="number"
              min="1"
              max={type === "SELL" ? ownedQty : undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={type === "SELL" && ownedQty > 0 ? `Max ${ownedQty} shares` : "Enter quantity"}
              className="rounded-xl font-tabular"
              disabled={type === "SELL" && ownedQty === 0}
            />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Price per share (PKR)
            </Label>
            <Input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter price"
              className="rounded-xl font-tabular"
              disabled={type === "SELL" && ownedQty === 0}
            />
          </div>

          {/* Summary */}
          <div className="bg-muted/50 p-3.5 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold font-tabular">
                PKR {formatPKR(total)}
              </span>
            </div>
            {type === "BUY" && selectedPortfolio && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Available Cash</span>
                <span className="font-tabular">
                  PKR {formatPKR(selectedPortfolio.cashBalance, { decimals: 0 })}
                </span>
              </div>
            )}
            {type === "SELL" && ownedQty > 0 && sellQty > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">P&L on this trade</span>
                <span className={`font-tabular font-semibold ${
                  (parseFloat(price) || 0) >= avgBuyPrice ? "text-emerald-600" : "text-red-500"
                }`}>
                  {(parseFloat(price) || 0) >= avgBuyPrice ? "+" : ""}
                  PKR {formatPKR(((parseFloat(price) || 0) - avgBuyPrice) * sellQty, { decimals: 0 })}
                </span>
              </div>
            )}
            {type === "BUY" &&
              selectedPortfolio &&
              total > selectedPortfolio.cashBalance && (
                <p className="text-xs text-red-500 font-medium">
                  Insufficient cash balance
                </p>
              )}
            {cantSellReason && (
              <p className="text-xs text-red-500 font-medium">
                {cantSellReason}
              </p>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <Button
            className={`w-full rounded-xl font-semibold h-11 ${
              type === "BUY"
                ? "bg-emerald-500 hover:bg-emerald-600"
                : "bg-red-500 hover:bg-red-600"
            } text-white`}
            onClick={handleSubmit}
            disabled={
              loading ||
              !quantity ||
              !price ||
              !portfolioId ||
              (type === "BUY" && selectedPortfolio ? total > selectedPortfolio.cashBalance : false) ||
              (type === "SELL" && (ownedQty === 0 || sellQty > ownedQty))
            }
          >
            {loading
              ? "Processing..."
              : `${type} ${quantity || 0} shares for PKR ${formatPKR(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
