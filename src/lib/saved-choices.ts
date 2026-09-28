/**
 * View selections that follow the user across devices: which chart range,
 * which benchmark, which filter. Pure helpers shared by the server (which
 * keeps them in the user's settings file) and the browser.
 *
 * Each choice carries the time it was made, and the most recent one wins, so
 * two devices never fight over a value.
 */

export interface SavedChoice {
  value: string;
  /** When it was chosen, in milliseconds since 1970. */
  at: number;
}

export type SavedChoices = Record<string, SavedChoice>;

const KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_VALUE_LENGTH = 24;
const MAX_CHOICES = 60;
/** A device with a wrong clock must not pin its choice as "newest" forever. */
const CLOCK_SLACK_MS = 60 * 1000;

function cleanChoice(raw: unknown, now: number): SavedChoice | null {
  if (!raw || typeof raw !== "object") return null;
  const { value, at } = raw as Partial<SavedChoice>;
  if (typeof value !== "string" || !value || value.length > MAX_VALUE_LENGTH) return null;
  if (typeof at !== "number" || !Number.isFinite(at) || at <= 0) return null;
  return { value, at: Math.min(Math.floor(at), now + CLOCK_SLACK_MS) };
}

/** Coerce anything (stored JSON, a request body) into safe choices. */
export function normalizeChoices(raw: unknown, now: number = Date.now()): SavedChoices {
  const out: SavedChoices = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, entry] of Object.entries(raw)) {
    if (!KEY_RE.test(key)) continue;
    const choice = cleanChoice(entry, now);
    if (choice) out[key] = choice;
    if (Object.keys(out).length >= MAX_CHOICES) break;
  }
  return out;
}

/** Combine two sets; for each key the more recent choice wins. */
export function mergeChoices(current: SavedChoices, incoming: SavedChoices): SavedChoices {
  const out: SavedChoices = { ...current };
  for (const [key, choice] of Object.entries(incoming)) {
    const existing = out[key];
    if (!existing || choice.at >= existing.at) out[key] = choice;
  }
  // Keep the most recent ones if the limit is ever exceeded.
  const keys = Object.keys(out);
  if (keys.length > MAX_CHOICES) {
    keys
      .sort((a, b) => out[b].at - out[a].at)
      .slice(MAX_CHOICES)
      .forEach((k) => delete out[k]);
  }
  return out;
}
