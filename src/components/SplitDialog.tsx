"use client";

import { useState } from "react";
import { Split } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StockSearch } from "@/components/StockSearch";

/**
 * Apply a stock split across all portfolios + models. A split (num:denom, e.g.
 * 2:1) multiplies shares by num/denom and divides avg price by the same ratio,
 * so position value is unchanged. Posts to /api/splits.
 */
export function SplitDialog({
  open,
  onOpenChange,
  initialSymbol = "",
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSymbol?: string;
  onSuccess?: () => void;
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [num, setNum] = useState("2");
  const [denom, setDenom] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string | null>(null);

  // Re-seed the symbol whenever the dialog is (re)opened for a specific stock.
  const reset = () => {
    setSymbol(initialSymbol);
    setNum("2");
    setDenom("1");
    setError("");
    setResult(null);
    setLoading(false);
  };

  const n = parseFloat(num);
  const d = parseFloat(denom);
  const ratioValid = Number.isFinite(n) && Number.isFinite(d) && n > 0 && d > 0 && n !== d;
  const ratio = ratioValid ? n / d : 1;

  const submit = async () => {
    if (!symbol.trim() || !ratioValid) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/splits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          numerator: n,
          denominator: d,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to apply split");
        return;
      }
      setResult(
        `Adjusted ${data.holdingsAdjusted} holding${data.holdingsAdjusted !== 1 ? "s" : ""} of ${data.symbol} across ${data.portfoliosAffected} portfolio${data.portfoliosAffected !== 1 ? "s" : ""} and ${data.modelsAffected} model${data.modelsAffected !== 1 ? "s" : ""}.`
      );
      onSuccess?.();
    } catch {
      setError("Failed to apply split");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="rounded-2xl border border-line bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Split className="h-5 w-5 text-ink-3" />
            Apply Stock Split
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-[10px] border border-line bg-gain-50 p-3.5 text-[13px] text-ink">
              {result}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full rounded-[10px] bg-brand py-2.5 text-[13px] font-semibold text-white hover:brightness-105"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* symbol */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Stock
              </label>
              {symbol ? (
                <div className="flex items-center justify-between rounded-[10px] border border-line bg-canvas px-3 py-2">
                  <span className="text-[15px] font-bold">{symbol.toUpperCase()}</span>
                  <button
                    onClick={() => setSymbol("")}
                    className="text-[12px] font-medium text-ink-3 hover:text-ink"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <StockSearch
                  onSelect={(s) => setSymbol(s.symbol)}
                  placeholder="Search the stock that split…"
                />
              )}
            </div>

            {/* ratio */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
                Split ratio
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={num}
                  onChange={(e) => setNum(e.target.value)}
                  className="num w-20 rounded-[10px] border border-line bg-canvas px-3 py-2 text-center text-lg outline-none focus:border-brand"
                />
                <span className="text-[15px] font-bold text-ink-3">for</span>
                <input
                  type="number"
                  min="1"
                  value={denom}
                  onChange={(e) => setDenom(e.target.value)}
                  className="num w-20 rounded-[10px] border border-line bg-canvas px-3 py-2 text-center text-lg outline-none focus:border-brand"
                />
              </div>
              <p className="text-[11px] text-ink-3">
                e.g. <span className="font-semibold text-ink">2 for 1</span> doubles your
                shares and halves the price. Use{" "}
                <span className="font-semibold text-ink">1 for 2</span> for a reverse split.
              </p>
            </div>

            {/* preview */}
            {symbol && ratioValid && (
              <div className="rounded-[10px] border border-line bg-canvas p-3 text-[12px]">
                <p className="mb-1 font-semibold text-ink-3">Effect on each holding</p>
                <div className="num flex items-center gap-2 text-ink">
                  <span>100 sh @ Rs 400</span>
                  <span className="text-ink-3">→</span>
                  <span className="font-semibold">
                    {Math.round(100 * ratio)} sh @ Rs {(400 / ratio).toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-3">
                  Position value is unchanged — only share count and price adjust.
                </p>
              </div>
            )}

            {error && (
              <p className="text-[12px] font-semibold" style={{ color: "var(--color-loss-strong)" }}>
                {error}
              </p>
            )}

            <button
              onClick={submit}
              disabled={loading || !symbol.trim() || !ratioValid}
              className="w-full rounded-[10px] bg-brand py-2.5 text-[13px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
            >
              {loading ? "Applying…" : "Apply Split"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
