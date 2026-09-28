import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import { isAdmin } from "@/lib/user-registry";
import { storeConfigured } from "@/lib/redis-store";
import {
  announcementProblem,
  clearAnnouncement,
  getAnnouncement,
  setAnnouncement,
} from "@/lib/announcement";

const PRIVATE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: PRIVATE });

/** Admins only; anyone else gets the same answer as a missing page. */
async function guard(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (!isAdmin(user.email)) return json({ error: "Not found" }, 404);
  if (!storeConfigured()) return json({ error: "Storage is not connected." }, 503);
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return json({ announcement: await getAnnouncement() });
}

export async function PUT(req: Request) {
  const denied = await guard();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const problem = announcementProblem(body?.message);
  if (problem) return json({ error: problem }, 400);

  const announcement = await setAnnouncement(
    body.message,
    body.tone === "warning" ? "warning" : "info"
  );
  if (!announcement) return json({ error: "Could not save. Try again in a moment." }, 502);
  return json({ announcement });
}

export async function DELETE() {
  const denied = await guard();
  if (denied) return denied;
  if (!(await clearAnnouncement()))
    return json({ error: "Could not remove it. Try again in a moment." }, 502);
  return json({ announcement: null });
}
