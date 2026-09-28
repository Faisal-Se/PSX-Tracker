/**
 * The list of people who have signed in: name, email, first sign-in and last
 * active day. Nothing about portfolios, holdings or money is kept here.
 *
 * Stored in the app's shared Redis store (see redis-store.ts). Every function
 * degrades to a no-op when the store is not configured or can't be reached,
 * so sign-in never depends on it.
 */

import { createHash } from "node:crypto";
import {
  connectionString,
  credentials,
  pipeline,
  storeConfigured,
  withClient,
} from "./redis-store";

export interface RegisteredUser {
  id: string;
  email: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
}

const USERS_INDEX = "psx:users";
const userKey = (id: string) => `psx:user:${id}`;
const MAX_LISTED = 2000;

/** Kept under its original name for the routes that use it. */
export const registryConfigured = storeConfigured;

/**
 * The owner's account, as the SHA-256 of the lower-cased address. The
 * repository is public, so the address itself is not written here. Knowing it
 * grants nothing anyway: access requires signing in to that Google account.
 */
const OWNER_EMAIL_HASHES = [
  "12b3d9d4e9dab25e6b4f75455ef543062fc12c04864262194e3be8d5c6a738e5",
];

/**
 * Who may see the user list: the owner, plus any addresses in the optional
 * comma-separated ADMIN_EMAILS setting.
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const address = email.trim().toLowerCase();
  if (!address) return false;

  const hash = createHash("sha256").update(address).digest("hex");
  if (OWNER_EMAIL_HASHES.includes(hash)) return true;

  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(address);
}

/**
 * Note that a user was active. The first call for a user also sets their
 * first sign-in date, which is never overwritten. Returns false when nothing
 * was stored.
 */
export async function recordUser(
  user: { id: string; email: string; name: string },
  now: Date = new Date()
): Promise<boolean> {
  if (!user.id || !user.email) return false;
  const stamp = now.toISOString();

  if (!credentials() && connectionString()) {
    const done = await withClient(async (client) => {
      await client
        .multi()
        .hSetNX(userKey(user.id), "firstSeen", stamp)
        .hSet(userKey(user.id), {
          email: user.email,
          name: user.name || "",
          lastSeen: stamp,
        })
        .zAdd(USERS_INDEX, { score: now.getTime(), value: user.id })
        .exec();
      return true;
    });
    return done === true;
  }

  const result = await pipeline([
    ["HSETNX", userKey(user.id), "firstSeen", stamp],
    ["HSET", userKey(user.id), "email", user.email, "name", user.name || "", "lastSeen", stamp],
    ["ZADD", USERS_INDEX, now.getTime(), user.id],
  ]);
  return result !== null;
}

/** Everyone who has signed in, most recently active first. */
export async function listUsers(): Promise<{
  total: number;
  users: RegisteredUser[];
} | null> {
  if (!credentials() && connectionString()) {
    return withClient(async (client) => {
      const total = Number(await client.zCard(USERS_INDEX)) || 0;
      const ids = (await client.zRange(USERS_INDEX, 0, MAX_LISTED - 1, {
        REV: true,
      })) as string[];
      if (ids.length === 0) return { total, users: [] };

      const batch = client.multi();
      for (const id of ids) batch.hGetAll(userKey(id));
      const rows = (await batch.exec()) as unknown[];

      const users: RegisteredUser[] = [];
      rows.forEach((row, i) => {
        const fields = (row ?? {}) as Record<string, string>;
        if (!fields.email) return;
        users.push({
          id: ids[i],
          email: String(fields.email),
          name: String(fields.name || ""),
          firstSeen: String(fields.firstSeen || fields.lastSeen || ""),
          lastSeen: String(fields.lastSeen || ""),
        });
      });
      return { total, users };
    });
  }

  const head = await pipeline([
    ["ZCARD", USERS_INDEX],
    ["ZRANGE", USERS_INDEX, 0, MAX_LISTED - 1, "REV"],
  ]);
  if (!head) return null;

  const total = Number(head[0]) || 0;
  const ids = Array.isArray(head[1]) ? (head[1] as string[]) : [];
  if (ids.length === 0) return { total, users: [] };

  const rows = await pipeline(ids.map((id) => ["HGETALL", userKey(id)]));
  if (!rows) return null;

  const users: RegisteredUser[] = [];
  rows.forEach((row, i) => {
    // HGETALL comes back as a flat [field, value, field, value, …] list.
    const fields: Record<string, string> = {};
    if (Array.isArray(row)) {
      for (let j = 0; j + 1 < row.length; j += 2) fields[String(row[j])] = String(row[j + 1]);
    }
    if (!fields.email) return;
    users.push({
      id: ids[i],
      email: fields.email,
      name: fields.name || "",
      firstSeen: fields.firstSeen || fields.lastSeen || "",
      lastSeen: fields.lastSeen || "",
    });
  });
  return { total, users };
}
