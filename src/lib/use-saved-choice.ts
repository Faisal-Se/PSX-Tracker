"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A selection that is remembered on this device — a chart range, a benchmark,
 * a filter. Works like useState, but the choice is kept in localStorage and
 * restored the next time the app opens.
 *
 * Every component using the same key shares the value, so picking 6M on one
 * chart applies wherever that chart appears, including other open tabs.
 *
 * The server-rendered page always starts from `fallback`; the saved value
 * takes over once the page is running in the browser, without a hydration
 * mismatch.
 */

const PREFIX = "psx-choice:";
const listeners = new Map<string, Set<() => void>>();
// Keeps a selection working for the session when storage is unavailable
// (private browsing, blocked site data).
const memory = new Map<string, string>();

function read(key: string): string | null {
  const held = memory.get(key);
  if (held !== undefined) return held;
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function subscribe(key: string, onChange: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(onChange);

  // A change made in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PREFIX + key) return;
    memory.delete(key);
    onChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    set.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSavedChoice<T extends string>(
  key: string,
  options: readonly T[],
  fallback: T
): [T, (next: T) => void] {
  const stored = useSyncExternalStore(
    (onChange) => subscribe(key, onChange),
    () => read(key),
    () => null
  );

  // A value that is no longer one of the options (renamed, removed) is ignored.
  const value =
    stored !== null && (options as readonly string[]).includes(stored)
      ? (stored as T)
      : fallback;

  const choose = useCallback(
    (next: T) => {
      memory.set(key, next);
      try {
        localStorage.setItem(PREFIX + key, next);
      } catch {
        // Not saved across visits, but still applies for this session.
      }
      listeners.get(key)?.forEach((notify) => notify());
    },
    [key]
  );

  return [value, choose];
}
