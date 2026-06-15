"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, Receipt, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { formatPKR } from "@/lib/market-status";
import { PageSkeleton } from "@/components/ui/skeleton";

interface Transaction {
  id: string;
  type: string;
  symbol: string;
  companyName: string;
  quantity: number;
  price: number;
  total: number;
  portfolioId: string;
  createdAt: string;
}

interface Portfolio {
  id: string;
  name: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [filterPortfolio, setFilterPortfolio] = useState("all");
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const portfolioParam =
      filterPortfolio !== "all" ? `?portfolioId=${filterPortfolio}` : "";
    const [txRes, portfolioRes] = await Promise.all([
      fetch(`/api/transactions${portfolioParam}`),
      fetch("/api/portfolios"),
    ]);

    if (txRes.ok) setTransactions(await txRes.json());
    if (portfolioRes.ok) setPortfolios(await portfolioRes.json());
    setInitialLoading(false);
  }, [filterPortfolio]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const portfolioMap = new Map(portfolios.map((p) => [p.id, p.name]));

  if (initialLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-end justify-between gap-4 animate-in-up">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card">
            <ArrowLeftRight className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Your complete trade history
            </p>
          </div>
        </div>
        <Select value={filterPortfolio} onValueChange={(v) => v && setFilterPortfolio(v)}>
          <SelectTrigger className="w-[200px] rounded-lg">
            <SelectValue placeholder="All Portfolios">
              {(value: string | null) => {
                if (!value || value === "all") return "All Portfolios";
                const p = portfolios.find((p) => p.id === value);
                return p ? p.name : value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            <SelectItem value="all">All Portfolios</SelectItem>
            {portfolios.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between animate-in-up-delay-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Trade History
        </p>
        <span className="text-xs text-muted-foreground font-tabular">
          {transactions.length} {transactions.length === 1 ? "trade" : "trades"}
        </span>
      </div>

      {/* Transactions Table */}
      <div className="border border-border bg-card rounded-xl overflow-hidden animate-in-up-delay-2">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl border border-border bg-card mb-4">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No transactions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start trading from the Market or Portfolio page
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    Portfolio
                  </th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Price
                  </th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isBuy = tx.type === "BUY";
                  return (
                    <tr
                      key={tx.id}
                      className="table-row-hover border-b border-border last:border-0 transition-colors"
                    >
                      <td className="py-3 px-4 text-muted-foreground font-tabular text-xs whitespace-nowrap">
                        {format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            color: isBuy
                              ? "var(--color-profit)"
                              : "var(--color-loss)",
                            background: isBuy
                              ? "var(--color-profit-bg)"
                              : "var(--color-loss-bg)",
                          }}
                        >
                          {isBuy ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/stock/${tx.symbol}`}
                          className="block hover:text-primary transition-colors"
                        >
                          <span className="font-semibold">{tx.symbol}</span>
                          <span className="block text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {tx.companyName}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">
                        {portfolioMap.get(tx.portfolioId) || "—"}
                      </td>
                      <td className="text-right py-3 px-4 font-tabular font-medium">
                        {tx.quantity}
                      </td>
                      <td className="text-right py-3 px-4 font-tabular">
                        {formatPKR(tx.price)}
                      </td>
                      <td className="text-right py-3 px-4 font-tabular font-semibold whitespace-nowrap">
                        PKR {formatPKR(tx.total, { decimals: 0 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
