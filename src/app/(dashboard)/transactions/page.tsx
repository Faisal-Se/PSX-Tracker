"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-blue-500/10">
              <ArrowLeftRight className="h-5 w-5 text-blue-500" />
            </div>
            Transactions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your complete trade history
          </p>
        </div>
        <Select value={filterPortfolio} onValueChange={(v) => v && setFilterPortfolio(v)}>
          <SelectTrigger className="w-[200px] rounded-xl">
            <SelectValue placeholder="All Portfolios">
              {(value: string | null) => {
                if (!value || value === "all") return "All Portfolios";
                const p = portfolios.find((p) => p.id === value);
                return p ? p.name : value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Portfolios</SelectItem>
            {portfolios.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transactions Table */}
      <Card className="rounded-xl shadow-sm border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trade History
            </CardTitle>
            <Badge variant="secondary" className="text-xs font-tabular">
              {transactions.length} {transactions.length === 1 ? "trade" : "trades"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted/50 mb-4">
                <Receipt className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No transactions yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Start trading from the Market or Portfolio page
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Portfolio
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Price
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="table-row-hover border-b border-border/30 last:border-0"
                    >
                      <td className="py-3.5 px-2 text-muted-foreground font-tabular text-xs">
                        {format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="py-3.5 px-2">
                        <Badge
                          variant="secondary"
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                            tx.type === "BUY"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                          }`}
                        >
                          {tx.type === "BUY" ? (
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 mr-0.5" />
                          )}
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-2">
                        <Link
                          href={`/stock/${tx.symbol}`}
                          className="hover:text-primary transition-colors"
                        >
                          <span className="font-semibold text-sm">
                            {tx.symbol}
                          </span>
                          <br />
                          <span className="text-[11px] text-muted-foreground">
                            {tx.companyName}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3.5 px-2 text-sm text-muted-foreground">
                        {portfolioMap.get(tx.portfolioId) || "\u2014"}
                      </td>
                      <td className="text-right py-3.5 px-2 font-tabular font-medium">
                        {tx.quantity}
                      </td>
                      <td className="text-right py-3.5 px-2 font-tabular">
                        {formatPKR(tx.price)}
                      </td>
                      <td className="text-right py-3.5 px-2 font-tabular font-semibold">
                        PKR {formatPKR(tx.total, { decimals: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
