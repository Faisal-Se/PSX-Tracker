export interface PSXStock {
  symbol: string;
  company: string;
  sector: string;
  open: number;
  high: number;
  low: number;
  current: number;
  change: number;
  changePercent: number;
  volume: number;
  ldcp: number;
  /**
   * 30-day average daily volume. The market list only carries this, not
   * today's volume — `open`, `high`, `low` and `volume` are 0 there and are
   * filled in by getQuote() for a single symbol.
   */
  avgVolume: number;
  marketCap: number;
  /** One-year price change %, not adjusted for payouts. 0 when unknown. */
  yearChangePercent: number;
}

export interface KSE100Data {
  current: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
}



let cachedMarketData: PSXStock[] | null = null;
let cachedKSE100: KSE100Data | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 60 seconds

/**
 * All listed symbols with their current price.
 *
 * Source: the public Stock Screener page. PSX removed the /market-watch
 * fragment this used to read (it now 404s for anything but PSX's own pages),
 * so the list no longer includes intraday open/high/low/volume — see
 * getQuote() for those.
 */
export async function getMarketWatch(): Promise<PSXStock[]> {
  const now = Date.now();
  if (cachedMarketData && now - cacheTimestamp < CACHE_DURATION) {
    return cachedMarketData;
  }

  try {
    const res = await fetch("https://dps.psx.com.pk/screener", {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`screener responded ${res.status}`);
    const stocks = parseScreener(await res.text());
    // An empty parse means the page layout changed; keep serving the last
    // good copy rather than replacing it with nothing.
    if (stocks.length === 0) throw new Error("screener parsed to 0 rows");
    cachedMarketData = stocks;
    cacheTimestamp = now;
    return stocks;
  } catch (error) {
    console.error("Failed to fetch market data:", error);
    return cachedMarketData || [];
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Screener row:
//   <td data-order="KEL"><a class="tbl__symbol" href="/company/KEL"
//        data-title="K-Electric Limited"><strong>KEL</strong></a></td>
//   <td>0824</td>                      (sector code)
//   <td>ALLSHR,KSE100,...</td>         (listed in)
//   then data-order cells, in order:
//   market cap, price, change %, 1-year change %, P/E, dividend yield,
//   free float, 30-day average volume
function parseScreener(html: string): PSXStock[] {
  const stocks: PSXStock[] = [];
  const tbody = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbody) return stocks;

  for (const row of tbody[1].split("</tr>")) {
    const symbolMatch = row.match(/href="\/company\/[^"]*"[^>]*>\s*<strong>([^<]+)<\/strong>/);
    if (!symbolMatch) continue;
    const symbol = decodeEntities(symbolMatch[1].trim());

    const companyMatch = row.match(/data-title="([^"]+)"/);
    const company = companyMatch ? decodeEntities(companyMatch[1]) : symbol;

    const sectorMatch = row.match(/<\/td>\s*<td>(\d+)<\/td>/);
    const sector = sectorMatch ? sectorMatch[1] : "Other";

    const orders: string[] = [];
    const orderRegex = /data-order="([^"]*)"/g;
    let m;
    while ((m = orderRegex.exec(row)) !== null) orders.push(m[1]);
    // [symbol, marketCap, price, change%, 1y%, pe, yield, freeFloat, avgVol]
    if (orders.length < 9) continue;

    const current = parseFloat(orders[2]) || 0;
    if (current <= 0) continue;
    const changePercent = parseFloat(orders[3]) || 0;
    // The page gives the % move; recover yesterday's close and the rupee move.
    const ldcp = round2(current / (1 + changePercent / 100));

    stocks.push({
      symbol,
      company,
      sector,
      open: 0,
      high: 0,
      low: 0,
      current,
      change: round2(current - ldcp),
      changePercent: round2(changePercent),
      volume: 0,
      ldcp,
      avgVolume: Math.round(parseFloat(orders[8]) || 0),
      marketCap: parseFloat(orders[1]) || 0,
      yearChangePercent: parseFloat(orders[4]) || 0,
    });
  }

  return stocks;
}

/**
 * Full quote for one symbol — today's open, high, low and volume — read from
 * its public company page. Returns null when the symbol has no page.
 */
export async function getQuote(symbol: string): Promise<PSXStock | null> {
  const listed = (await getMarketWatch()).find((s) => s.symbol === symbol) || null;

  try {
    const res = await fetch(
      `https://dps.psx.com.pk/company/${encodeURIComponent(symbol)}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return listed;
    const html = await res.text();

    // The first stats block is the regular market; futures tabs follow it.
    const stat = (label: string): number => {
      const m = html.match(
        new RegExp(
          `<div class="stats_label">${label}</div>\\s*<div class="stats_value">([^<]*)<`
        )
      );
      return m ? parseFloat(m[1].replace(/,/g, "")) || 0 : 0;
    };
    const closeMatch = html.match(/class="quote__close">\s*Rs\.?\s*([\d,.]+)/);
    const current = closeMatch ? parseFloat(closeMatch[1].replace(/,/g, "")) || 0 : 0;
    if (current <= 0) return listed;

    const changeMatch = html.match(/class="change__value">\s*(-?[\d,.]+)/);
    const percentMatch = html.match(/class="change__percent">\s*\((-?[\d,.]+)%\)/);
    const nameMatch = html.match(/class="quote__name">([^<]+)</);
    const change = changeMatch ? parseFloat(changeMatch[1].replace(/,/g, "")) || 0 : 0;

    return {
      symbol,
      company: nameMatch ? decodeEntities(nameMatch[1].trim()) : listed?.company || symbol,
      sector: listed?.sector || "Other",
      open: stat("Open"),
      high: stat("High"),
      low: stat("Low"),
      current,
      change,
      changePercent: percentMatch ? parseFloat(percentMatch[1]) || 0 : 0,
      volume: stat("Volume"),
      ldcp: stat("LDCP") || round2(current - change),
      avgVolume: listed?.avgVolume || 0,
      marketCap: listed?.marketCap || 0,
      yearChangePercent: listed?.yearChangePercent || 0,
    };
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    return listed;
  }
}

export async function getKSE100(): Promise<KSE100Data> {
  const now = Date.now();
  if (cachedKSE100 && now - cacheTimestamp < CACHE_DURATION) {
    return cachedKSE100;
  }

  try {
    const res = await fetch("https://dps.psx.com.pk/indices", {
      next: { revalidate: 60 },
    });
    const html = await res.text();

    // Find KSE100 row: <tr><td><a data-code="KSE100">...
    // data-order values: high, low, current, change, changePercent
    const kse100Match = html.match(
      /data-code="KSE100"[\s\S]*?<\/tr>/
    );

    if (kse100Match) {
      const row = kse100Match[0];
      const dataOrders: number[] = [];
      const orderRegex = /data-order="([^"]+)"/g;
      let match;
      while ((match = orderRegex.exec(row)) !== null) {
        dataOrders.push(parseFloat(match[1]) || 0);
      }

      // Order: high, low, current, change, changePercent
      if (dataOrders.length >= 5) {
        const result: KSE100Data = {
          high: dataOrders[0],
          low: dataOrders[1],
          current: dataOrders[2],
          change: dataOrders[3],
          changePercent: dataOrders[4],
          volume: 0,
          timestamp: new Date().toISOString(),
        };
        cachedKSE100 = result;
        return result;
      }
    }

    return fallbackKSE100();
  } catch (error) {
    console.error("Failed to fetch KSE-100:", error);
    return cachedKSE100 || fallbackKSE100();
  }
}

function fallbackKSE100(): KSE100Data {
  return {
    current: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
    volume: 0,
    timestamp: new Date().toISOString(),
  };
}

export interface IndexQuote {
  current: number;
  change: number;
}

/**
 * Every index on PSX's public indices page, plus the page's own "As of"
 * stamp — which says which trading session the site is currently showing.
 */
export async function getIndices(): Promise<{
  asOf: string | null;
  indices: Record<string, IndexQuote>;
}> {
  try {
    const res = await fetch("https://dps.psx.com.pk/indices", {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { asOf: null, indices: {} };
    const html = await res.text();

    const asOfMatch = html.match(/As of\s+([^<]+)</);
    const indices: Record<string, IndexQuote> = {};
    const rowRegex = /data-code="([A-Z0-9]+)"([\s\S]*?)<\/tr>/g;
    let row;
    while ((row = rowRegex.exec(html)) !== null) {
      const values: number[] = [];
      const orderRegex = /data-order="([^"]+)"/g;
      let m;
      while ((m = orderRegex.exec(row[2])) !== null) values.push(parseFloat(m[1]) || 0);
      // Order: high, low, current, change, changePercent
      if (values.length >= 5 && values[2] > 0) {
        indices[row[1]] = { current: values[2], change: values[3] };
      }
    }
    return { asOf: asOfMatch ? asOfMatch[1].trim() : null, indices };
  } catch (error) {
    console.error("Failed to fetch indices:", error);
    return { asOf: null, indices: {} };
  }
}

// ─── PSX data feed (history) ───
//
// PSX's chart feed answers only requests that look like its own pages: they
// carry a token embedded in every PSX page, plus browser-style headers. The
// token rotates during the day, so it is read from a page, kept briefly, and
// re-read once when a request is refused.
//
// This depends on PSX keeping that arrangement. Every caller must treat an
// empty result as normal and fall back to the app's own recorded history.

const FEED_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const TOKEN_PAGE = "https://dps.psx.com.pk/indices";
const TOKEN_TTL_MS = 10 * 60 * 1000;

let cachedToken: { value: string; at: number } | null = null;

async function getFeedToken(forceRefresh = false): Promise<string | null> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && now - cachedToken.at < TOKEN_TTL_MS) {
    return cachedToken.value;
  }
  try {
    const res = await fetch(TOKEN_PAGE, {
      headers: { "User-Agent": FEED_USER_AGENT },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const match = (await res.text()).match(/"_k":"([^"]+)"/);
    if (!match) return null;
    cachedToken = { value: match[1], at: now };
    return match[1];
  } catch {
    return null;
  }
}

async function fetchFeed(path: string): Promise<unknown | null> {
  for (const forceRefresh of [false, true]) {
    const token = await getFeedToken(forceRefresh);
    if (!token) return null;
    const res = await fetch(`https://dps.psx.com.pk${path}`, {
      headers: {
        "User-Agent": FEED_USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        "X-Req-Id": token,
        Accept: "application/json, text/javascript, */*; q=0.01",
        Referer: "https://dps.psx.com.pk/",
      },
      cache: "no-store",
    });
    if (res.ok) {
      try {
        return await res.json();
      } catch {
        return null;
      }
    }
    // Refused: the token may have rotated. Try once more with a fresh one.
  }
  return null;
}

export interface ClosePoint {
  date: string;
  close: number;
}

/**
 * Daily closing prices for a stock or index from PSX's feed, oldest first.
 * Returns [] whenever the feed is unavailable.
 */
export async function getStockHistory(symbol: string): Promise<ClosePoint[]> {
  try {
    const json = (await fetchFeed(
      `/timeseries/eod/${encodeURIComponent(symbol)}`
    )) as { data?: unknown } | null;
    if (!json || !Array.isArray(json.data)) return [];

    // Rows are [unix seconds, close, volume, open], newest first.
    const byDate = new Map<string, number>();
    for (const row of json.data as unknown[]) {
      if (!Array.isArray(row)) continue;
      const time = Number(row[0]);
      const close = Number(row[1]);
      if (!Number.isFinite(time) || !(close > 0)) continue;
      // Timestamps mark the session in Pakistan time (UTC+5).
      const date = new Date((time + 5 * 3600) * 1000).toISOString().slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, close);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, close]) => ({ date, close }));
  } catch (error) {
    console.error(`Failed to fetch history for ${symbol}:`, error);
    return [];
  }
}

export async function getStockPrice(
  symbol: string
): Promise<PSXStock | null> {
  const stocks = await getMarketWatch();
  return stocks.find((s) => s.symbol === symbol) || null;
}

export async function searchStocks(query: string): Promise<PSXStock[]> {
  const stocks = await getMarketWatch();
  const q = query.toUpperCase();
  return stocks.filter(
    (s) =>
      s.symbol.toUpperCase().includes(q) ||
      s.company.toUpperCase().includes(q)
  );
}
