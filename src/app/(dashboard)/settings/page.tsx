"use client";

import { useEffect, useState } from "react";
import { Receipt, RotateCcw, Check } from "lucide-react";
import { formatPKR } from "@/lib/market-status";
import { invalidateFeeSettings } from "@/lib/use-fee-settings";
import {
  FEE_KEYS,
  TYPICAL_PSX_FEES,
  ZERO_FEES,
  type FeeSettings,
  feesEnabled,
  normalizeFeeSettings,
  tradeFees,
} from "@/lib/fees";

const FIELDS: {
  key: keyof FeeSettings;
  label: string;
  unit: string;
  help: string;
  step: string;
}[] = [
  {
    key: "commissionPct",
    label: "Brokerage commission",
    unit: "% of trade value",
    help: "Your broker's headline rate. Most PSX retail brokers charge 0.10–0.15%.",
    step: "0.01",
  },
  {
    key: "minCommissionPerShare",
    label: "Minimum commission",
    unit: "Rs per share",
    help: "Floor applied to low-priced stocks: commission = max(%, this × shares). Often 3–5 paisa.",
    step: "0.01",
  },
  {
    key: "sstPct",
    label: "Sales tax on commission",
    unit: "% of commission",
    help: "Provincial sales tax on the brokerage fee itself. Sindh 13%, Punjab 16%.",
    step: "0.5",
  },
  {
    key: "leviesPct",
    label: "CDC, SECP & exchange levies",
    unit: "% of trade value",
    help: "Small regulatory charges bundled on every contract note, typically ~0.005%.",
    step: "0.001",
  },
];

// Worked example shown beside the form.
const EXAMPLE_SHARES = 500;
const EXAMPLE_PRICE = 200;

export default function SettingsPage() {
  const [form, setForm] = useState<Record<keyof FeeSettings, string>>({
    commissionPct: "",
    minCommissionPerShare: "",
    sstPct: "",
    leviesPct: "",
  });
  const [saved, setSaved] = useState<FeeSettings>(ZERO_FEES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const fees = normalizeFeeSettings(data?.fees);
        setSaved(fees);
        setForm(toForm(fees));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const draft = normalizeFeeSettings(
    Object.fromEntries(FEE_KEYS.map((k) => [k, form[k] === "" ? 0 : Number(form[k])]))
  );
  const dirty = FEE_KEYS.some((k) => draft[k] !== saved[k]);
  const invalid = FEE_KEYS.some((k) => form[k] !== "" && !Number.isFinite(Number(form[k])));

  const example = tradeFees(EXAMPLE_SHARES, EXAMPLE_PRICE, draft);
  const exampleValue = EXAMPLE_SHARES * EXAMPLE_PRICE;
  const effectivePct = exampleValue > 0 ? (example.total / exampleValue) * 100 : 0;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fees: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save");
        return;
      }
      const fees = normalizeFeeSettings(data.fees);
      invalidateFeeSettings();
      setSaved(fees);
      setForm(toForm(fees));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      setError("Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <div className="mb-0.5 flex items-center gap-2 text-[13px] font-medium text-ink-3">
          <Receipt className="h-[15px] w-[15px]" /> Settings
        </div>
        <h1 className="text-[24px] font-bold tracking-[-.02em]">Trading fees</h1>
      </div>

      <div className="grid gap-[18px] lg:grid-cols-[1.4fr_1fr]">
        {/* Form */}
        <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <p className="mb-5 text-[13px] leading-relaxed text-ink-2">
            Enter the rates from your broker&apos;s contract note. On a buy they are added to the
            cost basis, so the average price you see matches your statement. On a sell they are
            deducted from the proceeds and from realized P&amp;L. Leave everything at zero to
            track trades without fees.
          </p>

          <div className="space-y-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="grid gap-1.5 sm:grid-cols-[1fr_180px] sm:items-start sm:gap-4">
                <div>
                  <label htmlFor={f.key} className="text-[13px] font-semibold">
                    {f.label}
                  </label>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{f.help}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={f.key}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step={f.step}
                    value={form[f.key]}
                    placeholder={String(TYPICAL_PSX_FEES[f.key])}
                    disabled={loading}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    className="num h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-[14px] outline-none focus:border-brand disabled:opacity-60"
                  />
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-ink-3">{f.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-loss-50 px-3 py-2 text-[12.5px] font-medium text-loss-strong">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={save}
              disabled={loading || saving || !dirty || invalid}
              className="flex h-[38px] items-center gap-2 rounded-[10px] bg-brand px-4 text-[13px] font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {justSaved ? <Check className="h-4 w-4" /> : null}
              {saving ? "Saving…" : justSaved ? "Saved" : "Save fees"}
            </button>
            <button
              onClick={() => setForm(toForm(TYPICAL_PSX_FEES))}
              disabled={loading}
              className="h-[38px] rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium text-ink-2 shadow-card hover:bg-ink/[.04] disabled:opacity-50"
            >
              Use typical PSX rates
            </button>
            <button
              onClick={() => setForm(toForm(ZERO_FEES))}
              disabled={loading}
              className="flex h-[38px] items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium text-ink-3 hover:text-ink disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Turn off
            </button>
          </div>
        </section>

        {/* Worked example */}
        <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-3 text-[12px] font-semibold uppercase tracking-[.04em] text-ink-3">
            Example — buy {EXAMPLE_SHARES} shares @ Rs {EXAMPLE_PRICE}
          </div>
          <dl className="space-y-2 text-[13px]">
            <Row label="Trade value" value={exampleValue} />
            <Row label="Commission" value={example.commission} muted />
            <Row label="Sales tax" value={example.sst} muted />
            <Row label="Levies" value={example.levies} muted />
            <div className="my-2 border-t border-line" />
            <Row label="Total fees" value={example.total} bold />
            <Row label="All-in cost" value={exampleValue + example.total} bold />
          </dl>
          <p className="mt-4 text-[12px] text-ink-3">
            {feesEnabled(draft) ? (
              <>
                Effective rate <span className="num font-semibold text-ink">{effectivePct.toFixed(3)}%</span>.
                Per-share cost basis becomes{" "}
                <span className="num font-semibold text-ink">
                  Rs {formatPKR((exampleValue + example.total) / EXAMPLE_SHARES)}
                </span>{" "}
                instead of Rs {formatPKR(EXAMPLE_PRICE)}.
              </>
            ) : (
              "Fees are off. Trades are booked at the bare share price."
            )}
          </p>
          <p className="mt-3 text-[11.5px] leading-snug text-ink-3">
            Applies to trades you book from now on, in both real and model portfolios. Existing
            holdings are not restated.
          </p>
        </section>
      </div>
    </>
  );
}

function toForm(f: FeeSettings): Record<keyof FeeSettings, string> {
  return Object.fromEntries(
    FEE_KEYS.map((k) => [k, f[k] === 0 ? "" : String(f[k])])
  ) as Record<keyof FeeSettings, string>;
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: number;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-ink-3" : "text-ink-2"}>{label}</dt>
      <dd className={`num ${bold ? "font-bold" : muted ? "text-ink-2" : "font-semibold"}`}>
        Rs {formatPKR(value)}
      </dd>
    </div>
  );
}
