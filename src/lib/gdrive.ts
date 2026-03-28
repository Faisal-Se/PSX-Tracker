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
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
}

export { generateId };

// ─── Core Drive helpers ───

async function getDrive() {
  const client = await getAuthenticatedClient();
  if (!client) throw new Error("Not authenticated");
  return google.drive({ version: "v3", auth: client });
}

async function findFile(
  drive: ReturnType<typeof google.drive>,
  fileName: string
): Promise<string | null> {
  const res = await drive.files.list({
    spaces: "appDataFolder",
    q: `name = '${fileName}'`,
    fields: "files(id, name)",
    pageSize: 1,
  });
  return res.data.files?.[0]?.id || null;
}

async function readFile<T>(fileName: string, defaultValue: T): Promise<T> {
  try {
    const drive = await getDrive();
    const fileId = await findFile(drive, fileName);
    if (!fileId) return defaultValue;

    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" }
    );

    return JSON.parse(res.data as string) as T;
  } catch {
    return defaultValue;
  }
}

async function writeFile<T>(fileName: string, data: T): Promise<void> {
  const drive = await getDrive();
  const fileId = await findFile(drive, fileName);
  const content = JSON.stringify(data);

  const media = {
    mimeType: "application/json",
    body: Readable.from([content]),
  };

  if (fileId) {
    await drive.files.update({
      fileId,
      media,
    });
  } else {
    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: ["appDataFolder"],
      },
      media,
    });
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
  const portfolios = await getPortfolios();
  const now = new Date().toISOString();
  const portfolio: PortfolioData = {
    id: generateId(),
    ...data,
    holdings: [],
    transactions: [],
    createdAt: now,
    updatedAt: now,
  };
  portfolios.push(portfolio);
  await savePortfolios(portfolios);
  return portfolio;
}

export async function updatePortfolio(
  id: string,
  updater: (p: PortfolioData) => PortfolioData
): Promise<PortfolioData | null> {
  const portfolios = await getPortfolios();
  const idx = portfolios.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  portfolios[idx] = updater({
    ...portfolios[idx],
    updatedAt: new Date().toISOString(),
  });
  await savePortfolios(portfolios);
  return portfolios[idx];
}

export async function deletePortfolio(id: string): Promise<boolean> {
  const portfolios = await getPortfolios();
  const filtered = portfolios.filter((p) => p.id !== id);
  if (filtered.length === portfolios.length) return false;
  await savePortfolios(filtered);
  return true;
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
  const items = await getWatchlist();
  if (items.some((i) => i.symbol === symbol)) return null;
  const item: WatchlistItem = {
    id: generateId(),
    symbol,
    companyName,
    createdAt: new Date().toISOString(),
  };
  items.push(item);
  await saveWatchlist(items);
  return item;
}

export async function removeFromWatchlist(symbol: string): Promise<boolean> {
  const items = await getWatchlist();
  const filtered = items.filter((i) => i.symbol !== symbol);
  if (filtered.length === items.length) return false;
  await saveWatchlist(filtered);
  return true;
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
  const models = await getModelPortfolios();
  const now = new Date().toISOString();
  const model: ModelPortfolioData = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  models.push(model);
  await saveModelPortfolios(models);
  return model;
}

export async function updateModelPortfolio(
  id: string,
  updater: (m: ModelPortfolioData) => ModelPortfolioData
): Promise<ModelPortfolioData | null> {
  const models = await getModelPortfolios();
  const idx = models.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  models[idx] = updater({
    ...models[idx],
    updatedAt: new Date().toISOString(),
  });
  await saveModelPortfolios(models);
  return models[idx];
}

export async function deleteModelPortfolio(id: string): Promise<boolean> {
  const models = await getModelPortfolios();
  const filtered = models.filter((m) => m.id !== id);
  if (filtered.length === models.length) return false;
  await saveModelPortfolios(filtered);
  return true;
}
