import { NextResponse } from "next/server";
import { getAnnouncement } from "@/lib/announcement";
import { storeConfigured } from "@/lib/redis-store";

// The same for every visitor, so the CDN serves it: the banner costs the
// store at most one read a minute however many people have the app open.
const SHARED = "public, s-maxage=60, stale-while-revalidate=300";

/** GET /api/announcement — the current banner, or null. */
export async function GET() {
  const announcement = storeConfigured() ? await getAnnouncement() : null;
  return NextResponse.json(
    { announcement },
    { headers: { "Cache-Control": SHARED } }
  );
}
