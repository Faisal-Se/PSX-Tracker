"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Stock {
  symbol: string;
  company: string;
  current: number;
  change: number;
  changePercent: number;
}

interface StockSearchProps {
  onSelect: (stock: Stock) => void;
  placeholder?: string;
}

export function StockSearch({
  onSelect,
  placeholder = "Search stocks...",
}: StockSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const res = await fetch(
        `/api/psx?action=search&q=${encodeURIComponent(query)}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          onFocus={() => results.length > 0 && setIsOpen(true)}
        />
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl z-[100] max-h-64 overflow-y-auto">
          {results.map((stock) => (
            <button
              key={stock.symbol}
              className="w-full px-4 py-2.5 text-left hover:bg-accent flex items-center justify-between transition-colors"
              onClick={() => {
                onSelect(stock);
                setQuery("");
                setIsOpen(false);
              }}
            >
              <div>
                <span className="font-medium text-sm">{stock.symbol}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {stock.company}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium">
                  {stock.current > 0 ? `PKR ${stock.current.toFixed(2)}` : "—"}
                </span>
                {stock.change !== 0 && (
                  <span
                    className={`text-xs ml-2 ${
                      stock.change >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
                    }`}
                  >
                    {stock.change >= 0 ? "+" : ""}
                    {stock.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
