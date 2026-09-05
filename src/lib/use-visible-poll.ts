"use client";

import { useEffect, useRef } from "react";

/**
 * Run `fn` every `intervalMs`, but only while the tab is actually visible.
 *
 * A backgrounded tab polling live market data costs a full request cycle per
 * tick and shows nobody anything. This skips those ticks, and fires once as
 * soon as the tab is foregrounded again — so returning to the page shows
 * current data immediately rather than waiting out the remainder of a tick.
 *
 * The caller still owns the initial fetch on mount.
 */
export function useVisiblePoll(fn: () => void, intervalMs: number) {
  const saved = useRef(fn);

  useEffect(() => {
    saved.current = fn;
  }, [fn]);

  useEffect(() => {
    const run = () => {
      if (!document.hidden) saved.current();
    };
    const interval = setInterval(run, intervalMs);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", run);
    };
  }, [intervalMs]);
}
