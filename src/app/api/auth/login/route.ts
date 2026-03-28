import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-auth";

export async function GET() {
  const url = getAuthUrl();
  return NextResponse.json({ url });
}

export async function POST() {
  const url = getAuthUrl();
  return NextResponse.json({ url });
}
