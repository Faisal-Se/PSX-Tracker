import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent the CDN/browser from serving a stale cached HTML shell for the
  // dashboard pages (they render live data client-side, so a cached shell can
  // pin an old JS bundle across deploys). Force a fresh fetch every time.
  async headers() {
    const noStore = [
      { key: "Cache-Control", value: "no-store, must-revalidate" },
    ];
    return [
      { source: "/models", headers: noStore },
      { source: "/models/:id*", headers: noStore },
      { source: "/dashboard", headers: noStore },
      { source: "/portfolio", headers: noStore },
    ];
  },
};

export default nextConfig;
