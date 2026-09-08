"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/lib/use-sort";

interface SortHeaderProps<K extends string> {
  label: ReactNode;
  /** The column this header represents. */
  column: K;
  /** Active sort column. */
  sortKey: K;
  sortDir: SortDir;
  onToggle: (key: K) => void;
  /**
   * Set when the header is a grid cell: the button fills the cell and aligns
   * its content. Omit for inline use (see SortBar).
   */
  align?: "left" | "right";
  className?: string;
}

/**
 * A tappable column header. Inherits the surrounding header typography;
 * shows an arrow for the active column and reserves the arrow's space
 * otherwise so columns don't shift when the sort changes.
 */
export function SortHeader<K extends string>({
  label,
  column,
  sortKey,
  sortDir,
  onToggle,
  align,
  className,
}: SortHeaderProps<K>) {
  const active = column === sortKey;
  const Arrow = active && sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      aria-pressed={active}
      title={
        active
          ? `Sorted ${sortDir === "asc" ? "ascending" : "descending"} — tap to flip`
          : "Tap to sort by this column"
      }
      className={cn(
        "items-center gap-1 whitespace-nowrap transition-colors hover:text-ink",
        align ? "flex w-full" : "inline-flex",
        align === "right" && "justify-end text-right",
        align === "left" && "justify-start text-left",
        active && "text-ink",
        className
      )}
    >
      <span>{label}</span>
      <Arrow
        aria-hidden
        className={cn("h-3 w-3 shrink-0", active ? "opacity-100" : "opacity-0")}
      />
    </button>
  );
}

interface SortBarProps<K extends string> {
  options: { key: K; label: ReactNode }[];
  sortKey: K;
  sortDir: SortDir;
  onToggle: (key: K) => void;
  className?: string;
}

/** A row of sort buttons for card lists that have no column header. */
export function SortBar<K extends string>({
  options,
  sortKey,
  sortDir,
  onToggle,
  className,
}: SortBarProps<K>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold tracking-[.03em] text-ink-3",
        className
      )}
    >
      <span className="opacity-70">SORT</span>
      {options.map((o) => (
        <SortHeader
          key={o.key}
          label={o.label}
          column={o.key}
          sortKey={sortKey}
          sortDir={sortDir}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
