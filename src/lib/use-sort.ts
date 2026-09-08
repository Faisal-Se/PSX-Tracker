"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SortDir = "asc" | "desc";

export interface SortState<K extends string> {
  sortKey: K;
  sortDir: SortDir;
  /** Select a column, or flip direction when the active column is tapped again. */
  toggle: (key: K) => void;
  /**
   * Return a sorted copy of `rows`. `get` reads the comparable value for the
   * active column; rows for which `pinLast` is true keep their relative order
   * at the end regardless of sort (e.g. a Cash row).
   */
  sortRows: <T>(
    rows: T[],
    get: (row: T, key: K) => string | number,
    pinLast?: (row: T) => boolean
  ) => T[];
}

/**
 * Column-header sorting for a table or list.
 *
 * Text columns (`textKeys`) open ascending, everything else opens descending —
 * A→Z for names, biggest-first for numbers — and tapping the active column
 * flips it. The returned object is referentially stable while the sort is
 * unchanged, so it is safe in dependency arrays.
 */
export function useSort<K extends string>(
  defaultKey: K,
  textKeys: readonly K[] = [],
  defaultDir?: SortDir
): SortState<K> {
  // Callers usually pass `textKeys` as an inline literal, so keep the latest
  // value in a ref (updated after render) rather than in toggle's deps —
  // that keeps toggle, and the returned object, referentially stable.
  const textRef = useRef(textKeys);
  useEffect(() => {
    textRef.current = textKeys;
  });

  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(
    defaultDir ?? (textKeys.includes(defaultKey) ? "asc" : "desc")
  );

  const toggle = useCallback(
    (key: K) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      } else {
        setSortKey(key);
        setSortDir(textRef.current.includes(key) ? "asc" : "desc");
      }
    },
    [sortKey]
  );

  const sortRows = useCallback(
    <T,>(
      rows: T[],
      get: (row: T, key: K) => string | number,
      pinLast?: (row: T) => boolean
    ): T[] => {
      const cmp = (a: T, b: T) => {
        const av = get(a, sortKey);
        const bv = get(b, sortKey);
        let d: number;
        if (typeof av === "string" || typeof bv === "string") {
          d = String(av).localeCompare(String(bv));
        } else {
          const an = Number.isFinite(av) ? av : 0;
          const bn = Number.isFinite(bv) ? bv : 0;
          d = an - bn;
        }
        return sortDir === "desc" ? -d : d;
      };
      if (!pinLast) return [...rows].sort(cmp);
      const head = rows.filter((r) => !pinLast(r)).sort(cmp);
      const tail = rows.filter((r) => pinLast(r));
      return [...head, ...tail];
    },
    [sortKey, sortDir]
  );

  return useMemo(
    () => ({ sortKey, sortDir, toggle, sortRows }),
    [sortKey, sortDir, toggle, sortRows]
  );
}
