"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { formatPKR } from "@/lib/market-status";

interface Portfolio {
  id: string;
  name: string;
  cashBalance: number;
}

interface ParsedTrade {
  type: "BUY" | "SELL";
  symbol: string;
  companyName: string;
  quantity: number;
  price: number;
}

export default function ImportPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState("");
  const [csvText, setCsvText] = useState("");
  const [parsedTrades, setParsedTrades] = useState<ParsedTrade[]>([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Manual entry
  const [manualTrades, setManualTrades] = useState<
    { type: "BUY" | "SELL"; symbol: string; companyName: string; quantity: string; price: string }[]
  >([]);

  const fetchPortfolios = useCallback(async () => {
    const res = await fetch("/api/portfolios");
    if (res.ok) {
      const data = await res.json();
      setPortfolios(data);
      if (data.length > 0) setSelectedPortfolio(data[0].id);
    }
  }, []);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  const parseCsv = () => {
    setParseError("");
    setParsedTrades([]);

    const lines = csvText
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setParseError("CSV must have a header row and at least one data row");
      return;
    }

    // Parse header
    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const typeIdx = header.findIndex(
      (h) => h === "type" || h === "action" || h === "side"
    );
    const symbolIdx = header.findIndex(
      (h) => h === "symbol" || h === "ticker" || h === "stock"
    );
    const companyIdx = header.findIndex(
      (h) => h === "company" || h === "companyname" || h === "name"
    );
    const qtyIdx = header.findIndex(
      (h) =>
        h === "quantity" || h === "qty" || h === "shares" || h === "volume"
    );
    const priceIdx = header.findIndex(
      (h) => h === "price" || h === "rate" || h === "avg price"
    );

    if (symbolIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
      setParseError(
        "CSV must have columns: Symbol, Quantity, Price. Optional: Type, Company"
      );
      return;
    }

    const trades: ParsedTrade[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const type =
        typeIdx >= 0
          ? (cols[typeIdx]?.toUpperCase() as "BUY" | "SELL") || "BUY"
          : "BUY";
      const symbol = cols[symbolIdx]?.toUpperCase() || "";
      const companyName =
        companyIdx >= 0 ? cols[companyIdx] || symbol : symbol;
      const quantity = parseInt(cols[qtyIdx]) || 0;
      const price = parseFloat(cols[priceIdx]) || 0;

      if (symbol && quantity > 0 && price > 0) {
        trades.push({
          type: type === "SELL" ? "SELL" : "BUY",
          symbol,
          companyName,
          quantity,
          price,
        });
      }
    }

    if (trades.length === 0) {
      setParseError("No valid trades found in CSV");
      return;
    }

    setParsedTrades(trades);
  };

  const addManualTrade = () => {
    setManualTrades((prev) => [
      ...prev,
      { type: "BUY", symbol: "", companyName: "", quantity: "", price: "" },
    ]);
  };

  const importTrades = async (trades: ParsedTrade[]) => {
    if (!selectedPortfolio || trades.length === 0) return;
    setImporting(true);
    setImportResult(null);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId: selectedPortfolio, trades }),
      });

      const data = await res.json();
      if (res.ok) {
        setImportResult({
          success: true,
          message: `Successfully imported ${data.imported} trades.`,
        });
        setParsedTrades([]);
        setCsvText("");
        setManualTrades([]);
      } else {
        setImportResult({ success: false, message: data.error });
      }
    } catch {
      setImportResult({ success: false, message: "Import failed" });
    } finally {
      setImporting(false);
    }
  };

  const importManual = () => {
    const valid = manualTrades
      .filter(
        (t) =>
          t.symbol.trim() && parseInt(t.quantity) > 0 && parseFloat(t.price) > 0
      )
      .map((t) => ({
        type: t.type,
        symbol: t.symbol.toUpperCase().trim(),
        companyName: t.companyName.trim() || t.symbol.toUpperCase().trim(),
        quantity: parseInt(t.quantity),
        price: parseFloat(t.price),
      }));

    if (valid.length === 0) return;
    importTrades(valid);
  };

  const validManualCount = manualTrades.filter(
    (t) => t.symbol.trim() && parseInt(t.quantity) > 0 && parseFloat(t.price) > 0
  ).length;

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            Bulk import from CSV
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">
            Import Trades
          </h1>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-[18px] flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-[26px] w-[26px] place-items-center rounded-full border border-brand bg-brand text-[12px] font-bold text-white">
            1
          </div>
          <span className="text-[13px] font-semibold text-ink">Target</span>
        </div>
        <div className="h-px w-7 bg-line" />
        <div className="flex items-center gap-2.5">
          <div className="grid h-[26px] w-[26px] place-items-center rounded-full border border-line bg-canvas text-[12px] font-bold text-ink-3">
            2
          </div>
          <span className="text-[13px] font-semibold text-ink-3">Paste CSV</span>
        </div>
        <div className="h-px w-7 bg-line" />
        <div className="flex items-center gap-2.5">
          <div className="grid h-[26px] w-[26px] place-items-center rounded-full border border-line bg-canvas text-[12px] font-bold text-ink-3">
            3
          </div>
          <span className="text-[13px] font-semibold text-ink-3">
            Review &amp; Import
          </span>
        </div>
      </div>

      <div className="space-y-[18px]">
        {/* Step 1: Target Portfolio */}
        <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="text-[15px] font-bold">Choose target portfolio</div>
          <div className="mb-[18px] mt-1.5 text-[13px] text-ink-3">
            Imported trades will be added to this portfolio.
          </div>
          {portfolios.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[68px] animate-pulse rounded-xl bg-line-soft"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {portfolios.map((p) => {
                const active = selectedPortfolio === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPortfolio(p.id)}
                    className={`rounded-xl border p-4 text-left ${
                      active
                        ? "border-brand bg-brand-50"
                        : "border-line bg-card hover:border-brand/40"
                    }`}
                  >
                    <div className="text-[14px] font-bold">{p.name}</div>
                    <div className="num mt-0.5 text-[12px] text-ink-3">
                      Cash · Rs {formatPKR(p.cashBalance, { decimals: 0 })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 2: CSV Import */}
        <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="grid h-[26px] w-[26px] place-items-center rounded-full border border-line bg-canvas text-[12px] font-bold text-ink-3">
              2
            </div>
            <FileText className="h-4 w-4 text-ink-3" />
            <div className="text-[15px] font-bold">Import from CSV</div>
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
            Paste CSV data
          </div>
          <p className="mb-2 mt-1 text-[12px] text-ink-3">
            Required columns: Symbol, Quantity, Price. Optional: Type (BUY/SELL),
            Company.
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`Type,Symbol,Company,Quantity,Price\nBUY,HASCOL,Hascol Petroleum,100,16.50\nBUY,PPL,Pakistan Petroleum,50,290.00`}
            className="num h-40 w-full resize-none rounded-xl border border-dashed border-line bg-canvas px-4 py-3 text-[13px] outline-none focus:border-solid focus:border-brand"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={parseCsv}
              disabled={!csvText.trim()}
              className="flex h-10 items-center gap-2 rounded-[11px] border border-line bg-card px-4 text-[13px] font-semibold text-ink hover:bg-ink/[.04] disabled:opacity-50"
            >
              Parse CSV
            </button>
            {parsedTrades.length > 0 && (
              <button
                onClick={() => importTrades(parsedTrades)}
                disabled={importing}
                className="flex h-10 items-center gap-2 rounded-[11px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105 disabled:opacity-50"
              >
                {importing
                  ? "Importing…"
                  : `Import ${parsedTrades.length} Trade(s)`}
              </button>
            )}
          </div>

          {parseError && (
            <div
              className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium"
              style={{
                color: "var(--color-loss-strong)",
                background: "var(--color-loss-50)",
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          {parsedTrades.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-canvas text-[11px] font-semibold uppercase tracking-[.03em] text-ink-3">
                    <th className="px-3 py-2.5 text-left">Type</th>
                    <th className="px-3 py-2.5 text-left">Symbol</th>
                    <th className="px-3 py-2.5 text-left">Company</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Price</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTrades.map((t, i) => (
                    <tr
                      key={i}
                      className="border-b border-line-soft last:border-0"
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            color:
                              t.type === "BUY"
                                ? "var(--color-gain)"
                                : "var(--color-loss-strong)",
                            background:
                              t.type === "BUY"
                                ? "var(--color-gain-50)"
                                : "var(--color-loss-50)",
                          }}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold">{t.symbol}</td>
                      <td className="px-3 py-2.5 text-ink-3">{t.companyName}</td>
                      <td className="num px-3 py-2.5 text-right">{t.quantity}</td>
                      <td className="num px-3 py-2.5 text-right">
                        Rs {formatPKR(t.price)}
                      </td>
                      <td className="num px-3 py-2.5 text-right font-semibold">
                        Rs {formatPKR(t.quantity * t.price, { decimals: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Step 3: Manual Entry */}
        <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-[26px] w-[26px] place-items-center rounded-full border border-line bg-canvas text-[12px] font-bold text-ink-3">
                3
              </div>
              <Plus className="h-4 w-4 text-ink-3" />
              <div className="text-[15px] font-bold">Manual Entry</div>
            </div>
            <button
              onClick={addManualTrade}
              className="flex h-9 items-center gap-1.5 rounded-[10px] border border-line bg-card px-3 text-[13px] font-semibold text-ink hover:bg-ink/[.04]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </button>
          </div>

          {manualTrades.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-8 text-center">
              <p className="text-[13px] text-ink-3">
                Click &quot;Add Row&quot; to manually enter trades
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {manualTrades.map((trade, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-2.5"
                >
                  <select
                    value={trade.type}
                    onChange={(e) =>
                      setManualTrades((prev) =>
                        prev.map((t, idx) =>
                          idx === i
                            ? { ...t, type: e.target.value as "BUY" | "SELL" }
                            : t
                        )
                      )
                    }
                    className="h-9 rounded-[10px] border border-line bg-card px-2 text-[12px] font-semibold outline-none focus:border-brand"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                  <input
                    placeholder="Symbol"
                    value={trade.symbol}
                    onChange={(e) =>
                      setManualTrades((prev) =>
                        prev.map((t, idx) =>
                          idx === i
                            ? { ...t, symbol: e.target.value.toUpperCase() }
                            : t
                        )
                      )
                    }
                    className="h-9 w-24 rounded-[10px] border border-line bg-card px-2.5 text-[12px] font-semibold outline-none focus:border-brand"
                  />
                  <input
                    placeholder="Company"
                    value={trade.companyName}
                    onChange={(e) =>
                      setManualTrades((prev) =>
                        prev.map((t, idx) =>
                          idx === i ? { ...t, companyName: e.target.value } : t
                        )
                      )
                    }
                    className="h-9 min-w-[100px] flex-1 rounded-[10px] border border-line bg-card px-2.5 text-[12px] outline-none focus:border-brand"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={trade.quantity}
                    onChange={(e) =>
                      setManualTrades((prev) =>
                        prev.map((t, idx) =>
                          idx === i ? { ...t, quantity: e.target.value } : t
                        )
                      )
                    }
                    className="num h-9 w-20 rounded-[10px] border border-line bg-card px-2.5 text-right text-[12px] outline-none focus:border-brand"
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={trade.price}
                    onChange={(e) =>
                      setManualTrades((prev) =>
                        prev.map((t, idx) =>
                          idx === i ? { ...t, price: e.target.value } : t
                        )
                      )
                    }
                    className="num h-9 w-24 rounded-[10px] border border-line bg-card px-2.5 text-right text-[12px] outline-none focus:border-brand"
                  />
                  <button
                    onClick={() =>
                      setManualTrades((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      )
                    }
                    className="grid h-9 w-9 place-items-center rounded-[10px] text-ink-3 hover:bg-ink/[.04] hover:text-ink"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={importManual}
                disabled={importing || validManualCount === 0}
                className="flex h-10 items-center gap-2 rounded-[11px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105 disabled:opacity-50"
              >
                {importing ? "Importing…" : "Import Manual Trades"}
              </button>
            </div>
          )}
        </section>

        {/* Import Result */}
        {importResult && (
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-medium"
            style={{
              color: importResult.success
                ? "var(--color-gain)"
                : "var(--color-loss-strong)",
              background: importResult.success
                ? "var(--color-gain-50)"
                : "var(--color-loss-50)",
            }}
          >
            {importResult.success ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0" />
            )}
            {importResult.message}
          </div>
        )}
      </div>
    </>
  );
}
