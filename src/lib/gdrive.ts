import { google } from "googleapis";
import { getAuthenticatedClient } from "./google-auth";
import { Readable } from "stream";

// Each data type is stored as a separate JSON file in the user's Google Drive appDataFolder
// Files: portfolios.json, watchlist.json, model-portfolios.json

export interface DriveStorage {
  portfolios: PortfolioData[];
  watchlist: WatchlistItem[];
  modelPortfolios: ModelPortfolioData[];
}

export interface PortfolioData {
  id: string;
  name: string;
  type: string;
  cashBalance: number;
  holdings: HoldingData[];
  transactions: TransactionData[];
  createdAt: string;
  updatedAt: string;
}

export interface HoldingData {
  id: string;
  symbol: string;
  companyName: string;
  quantity: number;
  avgPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionData {
  id: string;
  type: string;
  symbol: string;
  companyName: string;
  quantity: number;
  price: number;
  total: number;
  portfolioId: string;
  createdAt: string;
  /** Realized gain/loss, set on SELL = (price − avgCost) × qty. */
  realizedPnl?: number;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  companyName: string;
  createdAt: string;
}

export interface ModelPortfolioData {
  id: string;
  name: string;
  description: string;
  cashBalance: number;
  allocations: ModelAllocationData[];
  transactions: ModelTransactionData[];
  createdAt: string;
  updatedAt: string;
}

export interface ModelAllocationData {
  id: string;
  symbol: string;
  companyName: string;
  percentage: number;
  shares: number;
  avgPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface ModelTransactionData {
  id: string;
  type: string;
  symbol: string;
  companyName: string;
  quantity: number;
  price: number;
  total: number;
  createdAt: string;
}

function generateId(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
  }
}

export { generateId };

// ─── Core Drive helpers ───

async function getDrive() {
  const client = await getAuthenticatedClient();
  if (!client) throw new Error("Not authenticated");
  return google.drive({ version: "v3", auth: client });
}

/**
 * Locate the data file. Returns the newest match (defends against duplicate
 * files that a past create-race could have produced) plus its revision id for
 * optimistic concurrency.
 */
async function findFile(
  drive: ReturnType<typeof google.drive>,
  fileName: string
): Promise<{ id: string; headRevisionId: string | null } | null> {
  const res = await drive.files.list({
    spaces: "appDataFolder",
    q: `name = '${fileName}'`,
    fields: "files(id, name, headRevisionId, modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: 10,
  });
  const file = res.data.files?.[0];
  if (!file?.id) return null;
  return { id: file.id, headRevisionId: file.headRevisionId ?? null };
}

async function readFile<T>(fileName: string, defaultValue: T): Promise<T> {
  try {
    const drive = await getDrive();
    const found = await findFile(drive, fileName);
    if (!found) return defaultValue;

    const res = await drive.files.get(
      { fileId: found.id, alt: "media" },
      { responseType: "text" }
    );

    return JSON.parse(res.data as string) as T;
  } catch {
    return defaultValue;
  }
}

async function writeFile<T>(fileName: string, data: T): Promise<void> {
  const drive = await getDrive();
  const found = await findFile(drive, fileName);
  const media = {
    mimeType: "application/json",
    body: Readable.from([JSON.stringify(data)]),
  };

  if (found) {
    await drive.files.update({ fileId: found.id, media });
  } else {
    await drive.files.create({
      requestBody: { name: fileName, parents: ["appDataFolder"] },
      media,
    });
  }
}

/**
 * Read-modify-write a Drive JSON file with optimistic concurrency. Reads the
 * file + its revision, applies `mutate`, and writes back guarded by
 * `If-Match: <revision>`. On a 412 (someone else wrote in between) it re-reads
 * and retries, so concurrent mutations serialize instead of clobbering.
 */
async function mutateFile<T>(
  fileName: string,
  defaultValue: T,
  mutate: (current: T) => T,
  attempt = 0
): Promise<T> {
  const drive = await getDrive();
  const found = await findFile(drive, fileName);

  // Read current contents (or default for a brand-new file).
  let current = defaultValue;
  if (found) {
    try {
      const res = await drive.files.get(
        { fileId: found.id, alt: "media" },
        { responseType: "text" }
      );
      current = JSON.parse(res.data as string) as T;
    } catch {
      current = defaultValue;
    }
  }

  const next = mutate(current);
  const media = {
    mimeType: "application/json",
    body: Readable.from([JSON.stringify(next)]),
  };

  try {
    if (found) {
      await drive.files.update(
        { fileId: found.id, media },
        // Guard the write on the revision we read.
        found.headRevisionId
          ? { headers: { "If-Match": found.headRevisionId } }
          : undefined
      );
    } else {
      await drive.files.create({
        requestBody: { name: fileName, parents: ["appDataFolder"] },
        media,
      });
    }
    return next;
  } catch (err: unknown) {
    const status = (err as { code?: number; status?: number })?.code ??
      (err as { response?: { status?: number } })?.response?.status;
    // 412 = precondition failed (revision changed). Retry with fresh read.
    if (status === 412 && attempt < 5) {
      return mutateFile(fileName, defaultValue, mutate, attempt + 1);
    }
    throw err;
  }
}

// ─── Portfolio operations ───

export async function getPortfolios(): Promise<PortfolioData[]> {
  return readFile<PortfolioData[]>("portfolios.json", []);
}

export async function savePortfolios(
  portfolios: PortfolioData[]
): Promise<void> {
  await writeFile("portfolios.json", portfolios);
}

export async function getPortfolio(
  id: string
): Promise<PortfolioData | null> {
  const portfolios = await getPortfolios();
  return portfolios.find((p) => p.id === id) || null;
}

export async function createPortfolio(
  data: Omit<PortfolioData, "id" | "holdings" | "transactions" | "createdAt" | "updatedAt">
): Promise<PortfolioData> {
  const now = new Date().toISOString();
  const portfolio: PortfolioData = {
    id: generateId(),
    ...data,
    holdings: [],
    transactions: [],
    createdAt: now,
    updatedAt: now,
  };
  await mutateFile<PortfolioData[]>("portfolios.json", [], (portfolios) => [
    ...portfolios,
    portfolio,
  ]);
  return portfolio;
}

export async function updatePortfolio(
  id: string,
  updater: (p: PortfolioData) => PortfolioData
): Promise<PortfolioData | null> {
  let result: PortfolioData | null = null;
  await mutateFile<PortfolioData[]>("portfolios.json", [], (portfolios) => {
    const idx = portfolios.findIndex((p) => p.id === id);
    if (idx === -1) return portfolios;
    const updated = updater({
      ...portfolios[idx],
      updatedAt: new Date().toISOString(),
    });
    result = updated;
    const next = [...portfolios];
    next[idx] = updated;
    return next;
  });
  return result;
}

export async function deletePortfolio(id: string): Promise<boolean> {
  let deleted = false;
  await mutateFile<PortfolioData[]>("portfolios.json", [], (portfolios) => {
    const filtered = portfolios.filter((p) => p.id !== id);
    deleted = filtered.length !== portfolios.length;
    return filtered;
  });
  return deleted;
}

// ─── Watchlist operations ───

export async function getWatchlist(): Promise<WatchlistItem[]> {
  return readFile<WatchlistItem[]>("watchlist.json", []);
}

export async function saveWatchlist(items: WatchlistItem[]): Promise<void> {
  await writeFile("watchlist.json", items);
}

export async function addToWatchlist(
  symbol: string,
  companyName: string
): Promise<WatchlistItem | null> {
  let item: WatchlistItem | null = null;
  await mutateFile<WatchlistItem[]>("watchlist.json", [], (items) => {
    if (items.some((i) => i.symbol === symbol)) return items;
    item = {
      id: generateId(),
      symbol,
      companyName,
      createdAt: new Date().toISOString(),
    };
    return [...items, item];
  });
  return item;
}

export async function removeFromWatchlist(symbol: string): Promise<boolean> {
  let removed = false;
  await mutateFile<WatchlistItem[]>("watchlist.json", [], (items) => {
    const filtered = items.filter((i) => i.symbol !== symbol);
    removed = filtered.length !== items.length;
    return filtered;
  });
  return removed;
}

// ─── Model Portfolio operations ───

export async function getModelPortfolios(): Promise<ModelPortfolioData[]> {
  return readFile<ModelPortfolioData[]>("model-portfolios.json", []);
}

export async function saveModelPortfolios(
  models: ModelPortfolioData[]
): Promise<void> {
  await writeFile("model-portfolios.json", models);
}

export async function getModelPortfolio(
  id: string
): Promise<ModelPortfolioData | null> {
  const models = await getModelPortfolios();
  return models.find((m) => m.id === id) || null;
}

export async function createModelPortfolio(
  data: Omit<ModelPortfolioData, "id" | "createdAt" | "updatedAt">
): Promise<ModelPortfolioData> {
  const now = new Date().toISOString();
  const model: ModelPortfolioData = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await mutateFile<ModelPortfolioData[]>("model-portfolios.json", [], (models) => [
    ...models,
    model,
  ]);
  return model;
}

export async function updateModelPortfolio(
  id: string,
  updater: (m: ModelPortfolioData) => ModelPortfolioData
): Promise<ModelPortfolioData | null> {
  let result: ModelPortfolioData | null = null;
  await mutateFile<ModelPortfolioData[]>("model-portfolios.json", [], (models) => {
    const idx = models.findIndex((m) => m.id === id);
    if (idx === -1) return models;
    const updated = updater({
      ...models[idx],
      updatedAt: new Date().toISOString(),
    });
    result = updated;
    const next = [...models];
    next[idx] = updated;
    return next;
  });
  return result;
}

export async function deleteModelPortfolio(id: string): Promise<boolean> {
  let deleted = false;
  await mutateFile<ModelPortfolioData[]>("model-portfolios.json", [], (models) => {
    const filtered = models.filter((m) => m.id !== id);
    deleted = filtered.length !== models.length;
    return filtered;
  });
  return deleted;
}
