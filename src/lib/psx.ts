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

export async function getMarketWatch(): Promise<PSXStock[]> {
  const now = Date.now();
  if (cachedMarketData && now - cacheTimestamp < CACHE_DURATION) {
    return cachedMarketData;
  }

  try {
    const res = await fetch("https://dps.psx.com.pk/market-watch", {
      next: { revalidate: 60 },
    });
    const html = await res.text();
    const stocks = parseMarketWatch(html);
    cachedMarketData = stocks;
    cacheTimestamp = now;
    return stocks;
  } catch (error) {
    console.error("Failed to fetch market watch:", error);
    return cachedMarketData || [];
  }
}

// Parse HTML table from dps.psx.com.pk/market-watch
// Row format: <tr>
//   <td data-search="KEL" data-order="KEL"><a data-title="K-Electric Limited"><strong>KEL</strong></a></td>
//   <td>0824</td>                          (sector code)
//   <td>ALLSHR,KSE100,...</td>            (listed in)
//   <td data-order="7.06">7.06</td>       (LDCP)
//   <td data-order="7.06">7.06</td>       (Open)
//   <td data-order="7.16">7.16</td>       (High)
//   <td data-order="6.87">6.87</td>       (Low)
//   <td data-order="6.93">6.93</td>       (Current)
//   <td data-order="-0.13">...</td>       (Change)
//   <td data-order="-1.84">...</td>       (Change %)
//   <td data-order="56993072">...</td>    (Volume)
function parseMarketWatch(html: string): PSXStock[] {
  const stocks: PSXStock[] = [];

  // Match each data row in tbody
  const rowRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/;
  const tbodyMatch = html.match(rowRegex);
  if (!tbodyMatch) return stocks;

  const tbody = tbodyMatch[1];
  const rows = tbody.split("</tr>");

  for (const row of rows) {
    // Extract symbol from data-search attribute
    const symbolMatch = row.match(/data-search="([^"]+)"/);
    if (!symbolMatch) continue;

    const symbol = symbolMatch[1];

    // Extract company name from data-title attribute
    const companyMatch = row.match(/data-title="([^"]+)"/);
    const company = companyMatch ? companyMatch[1] : symbol;

    // Extract all data-order values in order
    const dataOrders: string[] = [];
    const orderRegex = /data-order="([^"]+)"/g;
    let match;
    while ((match = orderRegex.exec(row)) !== null) {
      dataOrders.push(match[1]);
    }

    // data-order values: [symbol, sector(?), ldcp, open, high, low, current, change, changePercent, volume]
    // First data-order is the symbol itself, skip it
    // The sector td doesn't have data-order, so after symbol we get: ldcp, open, high, low, current, change, change%, volume
    if (dataOrders.length < 9) continue;

    const ldcp = parseFloat(dataOrders[1]) || 0;
    const open = parseFloat(dataOrders[2]) || 0;
    const high = parseFloat(dataOrders[3]) || 0;
    const low = parseFloat(dataOrders[4]) || 0;
    const current = parseFloat(dataOrders[5]) || 0;
    const change = parseFloat(dataOrders[6]) || 0;
    const changePercent = parseFloat(dataOrders[7]) || 0;
    const volume = parseInt(dataOrders[8]) || 0;

    // Extract sector code from second <td> (no data-order)
    const sectorMatch = row.match(/<\/td>\s*<td>(\d+)<\/td>/);
    const sector = sectorMatch ? sectorMatch[1] : "Other";

    stocks.push({
      symbol,
      company,
      sector,
      open,
      high,
      low,
      current,
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume,
      ldcp,
    });
  }

  return stocks;
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
    const text = await res.text();

    // Try JSON first
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        return data.map((item: Record<string, string>) => ({
          date: item.DATE || item.date || "",
          open: parseFloat(item.OPEN || item.open) || 0,
          high: parseFloat(item.HIGH || item.high) || 0,
          low: parseFloat(item.LOW || item.low) || 0,
          close: parseFloat(item.CLOSE || item.close) || 0,
          volume: parseInt(item.VOLUME || item.volume) || 0,
        }));
      }
    } catch {
      // Not JSON, try parsing HTML table
      const history: StockHistory[] = [];
      const rows = text.split("</tr>");
      for (const row of rows) {
        const orders: string[] = [];
        const orderRegex = /data-order="([^"]+)"/g;
        let match;
        while ((match = orderRegex.exec(row)) !== null) {
          orders.push(match[1]);
        }
        if (orders.length >= 6) {
          history.push({
            date: orders[0],
            open: parseFloat(orders[1]) || 0,
            high: parseFloat(orders[2]) || 0,
            low: parseFloat(orders[3]) || 0,
            close: parseFloat(orders[4]) || 0,
            volume: parseInt(orders[5]) || 0,
          });
        }
      }
      return history;
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
