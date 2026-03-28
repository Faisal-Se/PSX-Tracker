export type MarketStatus = "open" | "closed" | "pre-market" | "post-market";

export function getMarketStatus(): {
  status: MarketStatus;
  label: string;
  nextEvent: string;
} {
  const now = new Date();

  // Convert to Pakistan Standard Time (UTC+5)
  const pst = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Karachi" })
  );
  const day = pst.getDay(); // 0=Sun, 6=Sat
  const hours = pst.getHours();
  const minutes = pst.getMinutes();
  const time = hours * 60 + minutes;

  // PSX is closed on Saturday (6) and Sunday (0)
  if (day === 0 || day === 6) {
    return {
      status: "closed",
      label: "Weekend",
      nextEvent: "Opens Monday 9:30 AM",
    };
  }

  // PSX trading hours: 9:30 AM - 3:30 PM PKT (Mon-Fri)
  const preMarketStart = 9 * 60; // 9:00 AM
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM
  const postMarketEnd = 16 * 60; // 4:00 PM

  if (time < preMarketStart) {
    return {
      status: "closed",
      label: "Closed",
      nextEvent: "Pre-market at 9:00 AM",
    };
  }

  if (time >= preMarketStart && time < marketOpen) {
    return {
      status: "pre-market",
      label: "Pre-Market",
      nextEvent: "Opens at 9:30 AM",
    };
  }

  if (time >= marketOpen && time < marketClose) {
    return {
      status: "open",
      label: "Market Open",
      nextEvent: "Closes at 3:30 PM",
    };
  }

  if (time >= marketClose && time < postMarketEnd) {
    return {
      status: "post-market",
      label: "Post-Market",
      nextEvent: "Closed for the day",
    };
  }

  return {
    status: "closed",
    label: "Closed",
    nextEvent: "Opens tomorrow 9:30 AM",
  };
}

export function formatPKR(
  value: number,
  options?: { compact?: boolean; decimals?: number }
): string {
  const { compact = false, decimals = 2 } = options || {};

  if (compact) {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  }

  return value.toLocaleString("en-PK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
