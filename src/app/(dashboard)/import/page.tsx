"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
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

  return (
    <div className="space-y-6 lg:space-y-8 max-w-[1000px]">
      {/* Header */}
      <div className="animate-in-up">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
            <Upload className="h-5 w-5 text-blue-500" />
          </div>
          Import Trades
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Import trades from CSV or enter them manually
        </p>
      </div>

      {/* Portfolio Selection */}
      <Card className="rounded-2xl animate-in-up-delay-1">
        <CardContent className="pt-5 pb-4">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Target Portfolio
          </Label>
          <select
            value={selectedPortfolio}
            onChange={(e) => setSelectedPortfolio(e.target.value)}
            className="mt-2 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Cash: PKR {formatPKR(p.cashBalance, { decimals: 0 })})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* CSV Import */}
      <Card className="rounded-2xl animate-in-up-delay-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            Import from CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs font-semibold">
              Paste CSV Data
            </Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Required columns: Symbol, Quantity, Price. Optional: Type (BUY/SELL), Company
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`Type,Symbol,Company,Quantity,Price\nBUY,HASCOL,Hascol Petroleum,100,16.50\nBUY,PPL,Pakistan Petroleum,50,290.00`}
              className="w-full h-40 rounded-xl border border-border bg-background px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={parseCsv}
              disabled={!csvText.trim()}
              className="rounded-xl"
            >
              Parse CSV
            </Button>
            {parsedTrades.length > 0 && (
              <Button
                onClick={() => importTrades(parsedTrades)}
                disabled={importing}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {importing
                  ? "Importing..."
                  : `Import ${parsedTrades.length} Trade(s)`}
              </Button>
            )}
          </div>

          {parseError && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          {parsedTrades.length > 0 && (
            <div className="overflow-x-auto border border-border/50 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b bg-muted/30">
                    <th className="text-left py-2 px-3 font-semibold">Type</th>
                    <th className="text-left py-2 px-3 font-semibold">Symbol</th>
                    <th className="text-left py-2 px-3 font-semibold">Company</th>
                    <th className="text-right py-2 px-3 font-semibold">Qty</th>
                    <th className="text-right py-2 px-3 font-semibold">Price</th>
                    <th className="text-right py-2 px-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTrades.map((t, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-2 px-3">
                        <span
                          className={`text-xs font-bold ${t.type === "BUY" ? "text-emerald-600" : "text-red-500"}`}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold">{t.symbol}</td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {t.companyName}
                      </td>
                      <td className="py-2 px-3 text-right font-tabular">
                        {t.quantity}
                      </td>
                      <td className="py-2 px-3 text-right font-tabular">
                        {formatPKR(t.price)}
                      </td>
                      <td className="py-2 px-3 text-right font-tabular font-semibold">
                        {formatPKR(t.quantity * t.price, { decimals: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Entry */}
      <Card className="rounded-2xl animate-in-up-delay-3">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-500" />
              Manual Entry
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={addManualTrade}
              className="h-7 text-xs rounded-lg"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Row
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {manualTrades.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Click &quot;Add Row&quot; to manually enter trades
              </p>
            </div>
          ) : (
            <>
              {manualTrades.map((trade, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/50"
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
                    className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-semibold"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                  <Input
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
                    className="w-24 h-8 rounded-lg text-xs font-semibold"
                  />
                  <Input
                    placeholder="Company"
                    value={trade.companyName}
                    onChange={(e) =>
                      setManualTrades((prev) =>
                        prev.map((t, idx) =>
                          idx === i ? { ...t, companyName: e.target.value } : t
                        )
                      )
                    }
                    className="flex-1 min-w-[100px] h-8 rounded-lg text-xs"
                  />
                  <Input
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
                    className="w-20 h-8 rounded-lg text-xs font-tabular text-right"
                  />
                  <Input
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
                    className="w-24 h-8 rounded-lg text-xs font-tabular text-right"
                  />
                  <button
                    onClick={() =>
                      setManualTrades((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button
                onClick={importManual}
                disabled={
                  importing ||
                  manualTrades.filter(
                    (t) =>
                      t.symbol.trim() &&
                      parseInt(t.quantity) > 0 &&
                      parseFloat(t.price) > 0
                  ).length === 0
                }
                className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {importing ? "Importing..." : "Import Manual Trades"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Import Result */}
      {importResult && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
            importResult.success
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-red-500/10 text-red-500"
          }`}
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
  );
}
