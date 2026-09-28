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

export interface StockHistory {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

export async function getStockHistory(
  symbol: string
): Promise<StockHistory[]> {
  try {
    const res = await fetch(
      `https://dps.psx.com.pk/timeseries/eod/${encodeURIComponent(symbol)}`,
      { next: { revalidate: 3600 } }
    );
    // PSX now serves this endpoint only to its own pages and answers 404 to
    // everyone else. Until there is another source, history is simply empty.
    if (!res.ok) return [];
    const text = await res.text();

    const json = JSON.parse(text);

    // New API format: {status, message, data: [[timestamp, close, volume, open], ...]}
    if (json.data && Array.isArray(json.data)) {
      const history = json.data.map((item: number[]) => {
        const d = new Date(item[0] * 1000);
        const dateStr = d.toISOString().split("T")[0];
        const close = item[1] || 0;
        const open = item[3] || 0;
        return {
          date: dateStr,
          open,
          high: Math.max(open, close),
          low: Math.min(open, close),
          close,
          volume: item[2] || 0,
        };
      });
      // API returns newest-first, chart needs oldest-first
      history.reverse();
      return history;
    }

    // Legacy format: array of objects with named keys
    if (Array.isArray(json)) {
      return json.map((item: Record<string, string>) => ({
        date: item.DATE || item.date || "",
        open: parseFloat(item.OPEN || item.open) || 0,
        high: parseFloat(item.HIGH || item.high) || 0,
        low: parseFloat(item.LOW || item.low) || 0,
        close: parseFloat(item.CLOSE || item.close) || 0,
        volume: parseInt(item.VOLUME || item.volume) || 0,
      }));
    }

    return [];
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
