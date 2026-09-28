import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/google-auth";
import { isAdmin, recordUser, registryConfigured } from "@/lib/user-registry";

/** Remembers that this user was already counted today. */
const SEEN_COOKIE = "psx_seen";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Keep the user list current, at most once per user per day. This runs on
  // every page load, so the cookie is what keeps it to one write a day.
  if (registryConfigured()) {
    const today = `${new Date().toISOString().slice(0, 10)}:${user.id}`;
    const cookieStore = await cookies();
    if (cookieStore.get(SEEN_COOKIE)?.value !== today) {
      const stored = await recordUser(user);
      // Only mark the day as done once it was really stored.
      if (stored) {
        cookieStore.set(SEEN_COOKIE, today, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 2,
          path: "/",
        });
      }
    }
  }

  return NextResponse.json({
    user: { ...user, ...(isAdmin(user.email) ? { isAdmin: true } : {}) },
  });
}
