import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent the CDN/browser from serving a stale cached HTML shell for the
  // dashboard pages (they render live data client-side, so a cached shell can
  // pin an old JS bundle across deploys). Force a fresh fetch every time.
  async headers() {
    const noStore = [
      { key: "Cache-Control", value: "no-store, must-revalidate" },
    ];
    // Per-user API responses must never sit in a shared cache. Vercel already
    // treats dynamic route handlers as uncacheable; this makes the intent
    // explicit and survives any future change to that default. /api/psx is
    // deliberately absent: it is public market data and sets its own s-maxage.
    const privateApi = [{ key: "Cache-Control", value: "private, no-store" }];
    const privateApiSources = [
      "/api/auth/:path*",
      "/api/portfolios",
      "/api/portfolios/:path*",
      "/api/model-portfolios",
      "/api/model-portfolios/:path*",
      "/api/transactions",
      "/api/watchlist",
      "/api/splits",
      "/api/export",
      "/api/import",
      "/api/settings",
      "/api/history",
      "/api/admin/:path*",
    ];
    return [
      { source: "/models", headers: noStore },
      { source: "/models/:id*", headers: noStore },
      { source: "/dashboard", headers: noStore },
      { source: "/portfolio", headers: noStore },
      ...privateApiSources.map((source) => ({ source, headers: privateApi })),
    ];
  },
};

export default nextConfig;
