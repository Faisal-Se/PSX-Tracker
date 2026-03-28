import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-auth";

// Registration is now handled via Google OAuth
export async function POST() {
  const url = getAuthUrl();
  return NextResponse.json({ url });
}
