/**
 * The in-app announcement: one short message the owner writes, shown as a
 * banner to every signed-in user until it is removed.
 */

import { storeDelete, storeGet, storeSet } from "./redis-store";

export type AnnouncementTone = "info" | "warning";

export interface Announcement {
  /** Changes with every edit, so a dismissed banner returns when it is updated. */
  id: string;
  message: string;
  tone: AnnouncementTone;
  updatedAt: string;
}

export const ANNOUNCEMENT_MAX_LENGTH = 300;
const KEY = "psx:announcement";

function parse(raw: string | null): Announcement | null {
  if (!raw) return null;
  try {
    const a = JSON.parse(raw) as Partial<Announcement>;
    if (typeof a.id !== "string" || typeof a.message !== "string" || !a.message.trim())
      return null;
    return {
      id: a.id,
      message: a.message,
      tone: a.tone === "warning" ? "warning" : "info",
      updatedAt: typeof a.updatedAt === "string" ? a.updatedAt : "",
    };
  } catch {
    return null;
  }
}

export async function getAnnouncement(): Promise<Announcement | null> {
  return parse(await storeGet(KEY));
}

/** Checks a message before it is published. Returns the problem, or null. */
export function announcementProblem(message: unknown): string | null {
  if (typeof message !== "string" || !message.trim()) return "Write a message first.";
  if (message.trim().length > ANNOUNCEMENT_MAX_LENGTH)
    return `Keep it under ${ANNOUNCEMENT_MAX_LENGTH} characters.`;
  return null;
}

/** Publish or replace the announcement. Null when it could not be stored. */
export async function setAnnouncement(
  message: string,
  tone: AnnouncementTone,
  now: Date = new Date()
): Promise<Announcement | null> {
  const announcement: Announcement = {
    id: now.getTime().toString(36),
    // Collapse line breaks and runs of spaces: the banner is a single line.
    message: message.trim().replace(/\s+/g, " "),
    tone: tone === "warning" ? "warning" : "info",
    updatedAt: now.toISOString(),
  };
  const stored = await storeSet(KEY, JSON.stringify(announcement));
  return stored ? announcement : null;
}

export async function clearAnnouncement(): Promise<boolean> {
  return storeDelete(KEY);
}
