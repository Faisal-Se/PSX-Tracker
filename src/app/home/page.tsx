"use client";

import Link from "next/link";
import { useState } from "react";
import {
  TrendingUp,
  LineChart,
  ListChecks,
  ArrowRightLeft,
  ShieldCheck,
  BarChart3,
  FlaskConical,
} from "lucide-react";

/** Brand mark — trending-up + arrow, matches the design handoff svg / TopNav. */
function BrandMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 16 L9 10 L13 13 L20 5"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 5 V10 M20 5 H15"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const features = [
  {
    icon: LineChart,
    title: "Live KSE-100",
    desc: "Index, full market watch and per-stock history in real time.",
  },
  {
    icon: ListChecks,
    title: "Model Portfolios",
    desc: "Target allocations with rebalance, SIP and bulk-trade tools.",
  },
  {
    icon: ArrowRightLeft,
    title: "Virtual Trading",
    desc: "Practise BUY / SELL with virtual cash, zero risk.",
  },
  {
    icon: ShieldCheck,
    title: "Private by Design",
    desc: "Your data stays in your own Google Drive. Always.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    desc: "Allocation, sector and P&L breakdowns with exports.",
  },
  {
    icon: FlaskConical,
    title: "What-If Simulator",
    desc: "Model investments before committing a rupee.",
  },
];

const stats = [
  { value: "118,452", label: "KSE-100 index" },
  { value: "500+", label: "Stocks tracked" },
  { value: "14", label: "Screens" },
  { value: "100%", label: "Your data, private" },
];

const previewHoldings = [
  { sym: "OG", name: "OGDC", value: "Rs 171,240", change: "+20.5%", color: "#2563EB" },
  { sym: "LU", name: "LUCK", value: "Rs 316,925", change: "+25.8%", color: "#7C3AED" },
  { sym: "ME", name: "MEBL", value: "Rs 220,770", change: "+46.0%", color: "#0D9488" },
];

export default function LandingPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink antialiased">
      {/* ───────────── Header ───────────── */}
      <div className="border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6">
          <Link href="/home" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-[#4f8bf7] to-[#1d4ed8]">
              <BrandMark />
            </span>
            <span className="text-[16px] font-bold tracking-[-.02em]">
              PSX<span className="font-medium text-ink-3"> Tracker</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/about"
              className="px-2.5 text-[13.5px] font-medium text-ink-2"
            >
              About
            </Link>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex h-10 cursor-pointer items-center rounded-[11px] bg-brand px-[18px] text-[13.5px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] disabled:opacity-60"
            >
              {loading ? "Redirecting…" : "Sign in"}
            </button>
          </div>
        </div>
      </div>

      {/* ───────────── Hero ───────────── */}
      <div className="py-[72px]">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2">
          <div>
            <div className="mb-[22px] inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-brand">
              <span className="h-[7px] w-[7px] rounded-full bg-gain" />
              Live Pakistan Stock Exchange data
            </div>
            <h1 className="text-[52px] font-bold leading-[1.05] tracking-[-.035em]">
              Track the PSX.
              <br />
              <span className="text-brand">Invest smarter.</span>
            </h1>
            <p className="mb-[30px] mt-5 max-w-[460px] text-[17px] leading-[1.6] text-ink-2">
              A calm, beautiful home for your KSE-100 portfolio — model
              portfolios, virtual trading and deep analytics, with your data kept
              private in your own Google Drive.
            </p>
            <div className="flex flex-wrap items-center gap-3.5">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex h-[52px] cursor-pointer items-center gap-3 rounded-[13px] bg-ink px-6 text-[15.5px] font-semibold text-canvas shadow-[0_10px_26px_rgba(0,0,0,.18)] disabled:opacity-60"
              >
                <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-white text-[15px] font-bold text-[#4285F4]">
                  G
                </span>
                {loading ? "Redirecting…" : "Continue with Google"}
              </button>
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex h-[52px] cursor-pointer items-center rounded-[13px] border border-line px-5 text-[14.5px] font-semibold disabled:opacity-60"
              >
                View live demo →
              </button>
            </div>
            <div className="mt-4 text-[12.5px] text-ink-3">
              No credit card · Free forever · Sign in with Google
            </div>
          </div>

          {/* ── product preview: browser-frame mock ── */}
          <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_30px_80px_rgba(13,18,28,.18)]">
            <div className="flex items-center gap-1.5 border-b border-line-soft bg-canvas px-3.5 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <div className="mx-2.5 h-[18px] flex-1 rounded-md border border-line-soft bg-card" />
            </div>
            <div className="p-[18px]">
              <div className="text-[11px] font-medium text-ink-3">
                Total Portfolio Value
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <div className="num text-[28px] font-bold tracking-[-.03em]">
                  Rs 1,532,935
                </div>
                <span className="num rounded-md bg-gain-50 px-1.5 py-0.5 text-[12px] font-semibold text-gain">
                  +21.0%
                </span>
              </div>
              <div className="-mx-1 my-3 h-[88px]">
                <svg
                  viewBox="0 0 440 88"
                  preserveAspectRatio="none"
                  className="h-full w-full"
                >
                  <defs>
                    <linearGradient id="lp-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity=".26" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0.0 19.7 L19.1 24.5 L38.3 23.0 L57.4 24.1 L76.5 29.2 L95.7 29.6 L114.8 36.0 L133.9 35.3 L153.0 40.3 L172.2 41.9 L191.3 43.1 L210.4 41.4 L229.6 42.1 L248.7 48.7 L267.8 46.8 L287.0 47.8 L306.1 52.4 L325.2 52.5 L344.3 53.5 L363.5 57.7 L382.6 65.7 L401.7 67.6 L420.9 64.0 L440.0 72.3 L440 88 L0 88 Z"
                    fill="url(#lp-area)"
                  />
                  <path
                    d="M0.0 19.7 L19.1 24.5 L38.3 23.0 L57.4 24.1 L76.5 29.2 L95.7 29.6 L114.8 36.0 L133.9 35.3 L153.0 40.3 L172.2 41.9 L191.3 43.1 L210.4 41.4 L229.6 42.1 L248.7 48.7 L267.8 46.8 L287.0 47.8 L306.1 52.4 L325.2 52.5 L344.3 53.5 L363.5 57.7 L382.6 65.7 L401.7 67.6 L420.9 64.0 L440.0 72.3"
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              {previewHoldings.map((h) => (
                <div key={h.name} className="flex items-center gap-2.5 py-[7px]">
                  <span
                    className="grid shrink-0 place-items-center rounded-[10px] font-bold"
                    style={{
                      width: 26,
                      height: 26,
                      fontSize: "8.58px",
                      background: `${h.color}22`,
                      color: h.color,
                    }}
                  >
                    {h.sym}
                  </span>
                  <div className="flex-1 text-[12px] font-semibold">{h.name}</div>
                  <span className="num text-[12px] font-semibold">{h.value}</span>
                  <span className="num w-[52px] text-right text-[11px] font-semibold text-gain">
                    {h.change}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ───────────── Stats band ───────────── */}
      <div className="border-y border-line bg-card py-[34px]">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-5 px-6 text-center md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="num text-[30px] font-bold tracking-[-.02em]">
                {s.value}
              </div>
              <div className="mt-1 text-[13px] text-ink-3">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ───────────── Feature grid ───────────── */}
      <div className="py-[72px]">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-11 text-center">
            <h2 className="text-[34px] font-bold tracking-[-.03em]">
              Everything you need to follow the market
            </h2>
            <p className="mt-3 text-[16px] text-ink-2">
              From a quick glance to a deep dive — it is all here.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-line bg-card p-6 shadow-card"
              >
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                  <f.icon className="h-[19px] w-[19px]" strokeWidth={1.9} />
                </div>
                <div className="mb-1.5 text-[16px] font-bold">{f.title}</div>
                <div className="text-[13.5px] leading-[1.55] text-ink-3">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────────── CTA ───────────── */}
      <div className="pb-20">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="rounded-3xl bg-gradient-to-br from-brand to-brand-2 px-10 py-14 text-center shadow-[0_20px_60px_rgba(37,99,235,.25)]">
            <h2 className="text-[34px] font-bold tracking-[-.03em] text-white">
              Start tracking in seconds
            </h2>
            <p className="mb-7 mt-3.5 text-[16px] text-white/90">
              Sign in with Google — your portfolio data never leaves your Drive.
            </p>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="inline-flex h-[52px] cursor-pointer items-center gap-2.5 rounded-[13px] bg-white px-[26px] text-[15.5px] font-bold text-brand shadow-[0_10px_30px_rgba(0,0,0,.2)] disabled:opacity-60"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-[14px] font-bold">
                G
              </span>
              {loading ? "Redirecting…" : "Continue with Google"}
            </button>
          </div>
        </div>
      </div>

      {/* ───────────── Footer ───────────── */}
      <div className="border-t border-line bg-card py-[26px]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6">
          <div className="flex items-baseline gap-3">
            <span
              className="text-[27px]"
              style={{ fontFamily: "var(--font-signature), cursive" }}
            >
              Faisal Qayyum
            </span>
            <span className="text-[12px] font-medium text-ink-3">PSX Tracker</span>
          </div>
          <div className="text-[12px] text-ink-3">
            © 2026 · Designed &amp; built with care
          </div>
        </div>
      </div>
    </div>
  );
}
