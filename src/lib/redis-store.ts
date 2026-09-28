/**
 * The app's small shared store: Redis, through whichever connection settings
 * the Vercel storage integration added to the project.
 *   - a Redis connection string (REDIS_URL) — the "Redis" product, or
 *   - a REST endpoint and token (KV_REST_API_* / UPSTASH_REDIS_REST_*) —
 *     "Upstash for Redis".
 *
 * Everything here returns null on failure instead of throwing, and gives up
 * after a short timeout, so no page ever depends on the store being up.
 */

import { createClient } from "redis";

const REQUEST_TIMEOUT_MS = 2500;

export function credentials(): { url: string; token: string } | null {
  // The Vercel integration uses the KV_ names; Upstash's own docs use the others.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

/** A redis:// or rediss:// connection string, under any of its usual names. */
export function connectionString(): string | null {
  const isRedisUrl = (v: string | undefined): v is string =>
    !!v && /^rediss?:\/\//.test(v);
  if (isRedisUrl(process.env.REDIS_URL)) return process.env.REDIS_URL;
  if (isRedisUrl(process.env.KV_URL)) return process.env.KV_URL;
  // Vercel lets a store be connected with a custom prefix, e.g. STORAGE_REDIS_URL.
  for (const [name, value] of Object.entries(process.env)) {
    if (/_REDIS_URL$/.test(name) && isRedisUrl(value)) return value;
  }
  return null;
}

export function storeConfigured(): boolean {
  return credentials() !== null || connectionString() !== null;
}

// ─── Redis connection-string store ───

function makeClient(url: string) {
  return createClient({
    url,
    RESP: 2,
    // Fail fast instead of queueing or retrying: the caller falls back.
    disableOfflineQueue: true,
    socket: { connectTimeout: REQUEST_TIMEOUT_MS, reconnectStrategy: false },
  });
}

export type Client = ReturnType<typeof makeClient>;
let clientPromise: Promise<Client | null> | null = null;

function discard(client: Client | null) {
  try {
    client?.destroy();
  } catch {
    // Already closed.
  }
}

/** A connected client, reused across requests while it stays healthy. */
async function getClient(): Promise<Client | null> {
  const url = connectionString();
  if (!url) return null;

  if (clientPromise) {
    const existing = await clientPromise;
    if (existing?.isReady) return existing;
    discard(existing);
    clientPromise = null;
  }

  clientPromise = (async () => {
    const client = makeClient(url);
    client.on("error", () => {
      // Surfaced through the failed command; nothing to do here.
    });
    try {
      await client.connect();
      return client;
    } catch {
      discard(client);
      return null;
    }
  })();

  const client = await clientPromise;
  if (!client) clientPromise = null;
  return client;
}

/** Run something against the client, giving up after the timeout. */
export async function withClient<T>(run: (client: Client) => Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), REQUEST_TIMEOUT_MS);
    });
    const work = (async () => {
      const client = await getClient();
      return client ? await run(client) : null;
    })();
    const result = await Promise.race([work, timeout]);
    if (result === null) {
      // Timed out or failed: don't reuse a connection in an unknown state.
      work.catch(() => {});
      const stale = clientPromise;
      clientPromise = null;
      stale?.then(discard).catch(() => {});
    }
    return result;
  } catch {
    clientPromise = null;
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type Command = (string | number)[];

/** Run commands in one request. Returns null on any failure. */
export async function pipeline(commands: Command[]): Promise<unknown[] | null> {
  const creds = credentials();
  if (!creds) return null;
  try {
    const res = await fetch(`${creds.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { result?: unknown; error?: string }[];
    if (!Array.isArray(rows) || rows.some((r) => r?.error)) return null;
    return rows.map((r) => r.result);
  } catch {
    return null;
  }
}


/** True when the connection-string store is the one in use. */
function usesConnectionString(): boolean {
  return !credentials() && connectionString() !== null;
}

/** Read one text value. Null when missing or when the store is unavailable. */
export async function storeGet(key: string): Promise<string | null> {
  if (usesConnectionString()) {
    const value = await withClient((client) => client.get(key));
    return typeof value === "string" ? value : null;
  }
  const rows = await pipeline([["GET", key]]);
  return rows && typeof rows[0] === "string" ? rows[0] : null;
}

/** Write one text value. Returns false when nothing was stored. */
export async function storeSet(key: string, value: string): Promise<boolean> {
  if (usesConnectionString()) {
    return (await withClient(async (client) => {
      await client.set(key, value);
      return true;
    })) === true;
  }
  return (await pipeline([["SET", key, value]])) !== null;
}

/** Remove a value. Returns false when the store could not be reached. */
export async function storeDelete(key: string): Promise<boolean> {
  if (usesConnectionString()) {
    return (await withClient(async (client) => {
      await client.del(key);
      return true;
    })) === true;
  }
  return (await pipeline([["DEL", key]])) !== null;
}
