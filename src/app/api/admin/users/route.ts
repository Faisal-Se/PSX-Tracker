import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import { isAdmin, listUsers, registryConfigured } from "@/lib/user-registry";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** The user list, for the accounts named in ADMIN_EMAILS only. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: PRIVATE }
    );
  }
  // Answer exactly as a missing page would, so the route reveals nothing.
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE });
  }

  if (!registryConfigured()) {
    return NextResponse.json(
      {
        error:
          "User storage is not connected. The app looked for REDIS_URL, KV_REST_API_URL and UPSTASH_REDIS_REST_URL and found none. After connecting a store in Vercel, redeploy so the app picks up the new settings.",
      },
      { status: 503, headers: PRIVATE }
    );
  }

  const list = await listUsers();
  if (!list) {
    return NextResponse.json(
      { error: "Could not reach the user storage. Try again in a moment." },
      { status: 502, headers: PRIVATE }
    );
  }
  return NextResponse.json(list, { headers: PRIVATE });
}
