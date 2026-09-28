"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { SavedChoices } from "./saved-choices";

/**
 * A selection that is remembered — a chart range, a benchmark, a filter.
 * Works like useState, but the choice is restored the next time the app
 * opens, on this device and on the user's other devices.
 *
 * Two layers:
 *  - localStorage, so the choice is there instantly on this device;
 *  - the user's settings file (in their Google Drive), so it follows them.
 *    Each choice carries the time it was made and the most recent one wins.
 *
 * Every component using the same key shares the value, so picking 6M on one
 * chart applies wherever that chart appears, including other open tabs.
 *
 * The server-rendered page always starts from `fallback`; the saved value
 * takes over once the page is running in the browser, without a hydration
 * mismatch.
 */

const PREFIX = "psx-choice:";
const TIME_PREFIX = "psx-choice-at:";
const PUSH_DELAY_MS = 1500;

const listeners = new Map<string, Set<() => void>>();
// Keeps a selection working for the session when storage is unavailable
// (private browsing, blocked site data).
const memory = new Map<string, string>();
const memoryTimes = new Map<string, number>();

function read(key: string): string | null {
  const held = memory.get(key);
  if (held !== undefined) return held;
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function readTime(key: string): number {
  const held = memoryTimes.get(key);
  if (held !== undefined) return held;
  try {
    return Number(localStorage.getItem(TIME_PREFIX + key)) || 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: string, at: number) {
  memory.set(key, value);
  memoryTimes.set(key, at);
  try {
    localStorage.setItem(PREFIX + key, value);
    localStorage.setItem(TIME_PREFIX + key, String(at));
  } catch {
    // Not saved on this device, but still applies for this session.
  }
  listeners.get(key)?.forEach((notify) => notify());
}

/** Every choice this device knows about, with when it was made. */
function localChoices(): SavedChoices {
  const out: SavedChoices = {};
  const add = (key: string) => {
    const value = read(key);
    // A choice saved before choices were timestamped counts as the oldest.
    const at = readTime(key) || 1;
    if (value) out[key] = { value, at };
  };
  for (const key of memory.keys()) add(key);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (name?.startsWith(PREFIX)) add(name.slice(PREFIX.length));
    }
  } catch {
    // Storage blocked: the in-memory ones above are all there is.
  }
  return out;
}

// ─── Account sync ───

const pending: SavedChoices = {};
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pulled = false;

async function pushNow() {
  pushTimer = null;
  const choices = { ...pending };
  const keys = Object.keys(choices);
  if (keys.length === 0) return;
  for (const k of keys) delete pending[k];
  try {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choices }),
      keepalive: true,
    });
    // Signed out or a server problem: keep them for the next attempt.
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    for (const k of keys) if (!pending[k] || pending[k].at < choices[k].at) pending[k] = choices[k];
  }
}

function queuePush(key: string, value: string, at: number) {
  pending[key] = { value, at };
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, PUSH_DELAY_MS);
}

/**
 * Once per page load: take newer choices from the account, and send it any
 * this device made that it doesn't have yet (for example while offline).
 */
async function pullOnce() {
  if (pulled) return;
  pulled = true;
  try {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const remote = ((await res.json())?.choices ?? {}) as SavedChoices;

    for (const [key, choice] of Object.entries(remote)) {
      if (!choice || typeof choice.value !== "string") continue;
      if (choice.at > readTime(key)) write(key, choice.value, choice.at);
    }
    for (const [key, choice] of Object.entries(localChoices())) {
      const theirs = remote[key];
      if (!theirs || theirs.at < choice.at) queuePush(key, choice.value, choice.at);
    }
  } catch {
    // Offline or signed out: this device's own choices still apply.
  }
}

function subscribe(key: string, onChange: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(onChange);
  void pullOnce();

  // A change made in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PREFIX + key) return;
    memory.delete(key);
    memoryTimes.delete(key);
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
      const at = Date.now();
      write(key, next, at);
      queuePush(key, next, at);
    },
    [key]
  );

  return [value, choose];
}
