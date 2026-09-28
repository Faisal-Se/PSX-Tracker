import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/google-auth";
import { getSettings, updateSettings } from "@/lib/gdrive";
import { FEE_KEYS, FEE_LIMITS, type FeeSettings } from "@/lib/fees";
import { mergeChoices, normalizeChoices } from "@/lib/saved-choices";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json(await getSettings());
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const fees = (body?.fees ?? {}) as Partial<Record<keyof FeeSettings, unknown>>;

  // Validate loudly rather than silently clamping: a mistyped rate should be
  // rejected, not quietly stored as something else.
  const next: Partial<FeeSettings> = {};
  for (const k of FEE_KEYS) {
    if (fees[k] === undefined) continue;
    const n = Number(fees[k]);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json(
        { error: `${k} must be a non-negative number` },
        { status: 400 }
      );
    }
    if (n > FEE_LIMITS[k]) {
      return NextResponse.json(
        { error: `${k} looks too high (max ${FEE_LIMITS[k]}). Check the units.` },
        { status: 400 }
      );
    }
    next[k] = n;
  }

  // View selections from this device; for each, the most recent choice wins.
  const incoming = normalizeChoices(body?.choices);

  const updated = await updateSettings((cur) => ({
    ...cur,
    fees: { ...cur.fees, ...next },
    choices: mergeChoices(cur.choices, incoming),
    updatedAt: new Date().toISOString(),
  }));
  return NextResponse.json(updated);
}
