"use client";

import { useEffect, useState } from "react";
import { ZERO_FEES, normalizeFeeSettings, type FeeSettings } from "./fees";

// One fetch per page load, shared by every component that previews a trade.
let cache: FeeSettings | null = null;
let inflight: Promise<FeeSettings> | null = null;

function load(): Promise<FeeSettings> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        cache = normalizeFeeSettings(d?.fees);
        return cache;
      })
      .catch(() => ZERO_FEES)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * The user's trading-fee settings, for previewing a trade exactly as the
 * server will book it. Zero (fees off) until loaded.
 */
export function useFeeSettings(): FeeSettings {
  const [fees, setFees] = useState<FeeSettings>(cache ?? ZERO_FEES);
  useEffect(() => {
    let on = true;
    load().then((f) => {
      if (on) setFees(f);
    });
    return () => {
      on = false;
    };
  }, []);
  return fees;
}

/** Call after saving settings so other pages don't keep a stale copy. */
export function invalidateFeeSettings() {
  cache = null;
}
