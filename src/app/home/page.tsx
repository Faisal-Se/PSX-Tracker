"use client";

import Link from "next/link";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowRight,
  PieChart,
  LineChart,
  Layers,
  Wallet,
  ShieldCheck,
  Sparkles,
  BarChart3,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground antialiased">
      {/* ───────────── Nav ───────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/home" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-[18px] w-[18px] text-primary-foreground" strokeWidth={2.4} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">PSX Tracker</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#preview" className="transition-colors hover:text-foreground">Product</a>
            <a href="#models" className="transition-colors hover:text-foreground">Model Portfolios</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open app
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      {/* ───────────── Hero ───────────── */}
      <section className="relative overflow-hidden">
        {/* ambient gradient wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[480px] max-w-5xl opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 22%, transparent), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-16 text-center lg:pt-32">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Pakistan Stock Exchange · live KSE-100 tracking
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight lg:text-7xl">
            Your PSX portfolio,
            <br />
            <span className="text-primary">beautifully tracked.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground lg:text-xl">
            Monitor the market, build model portfolios, and watch your gains in
            real time — with an interface that actually feels good to use.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#preview"
              className="inline-flex h-11 items-center rounded-xl border border-border bg-card px-6 text-sm font-medium transition-colors hover:bg-muted"
            >
              See it in action
            </a>
          </div>
        </div>

        {/* ── product preview mock ── */}
        <div id="preview" className="relative mx-auto max-w-5xl px-6 pb-24">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/5">
            {/* fake browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-muted-foreground/25" />
              <span className="h-3 w-3 rounded-full bg-muted-foreground/25" />
              <span className="h-3 w-3 rounded-full bg-muted-foreground/25" />
              <div className="ml-3 h-5 flex-1 rounded-md bg-muted" />
            </div>
            <div className="p-6 lg:p-8">
              {/* hero value row */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Portfolio Value
                  </p>
                  <p className="mt-1 font-tabular text-4xl font-semibold tracking-tight lg:text-5xl">
                    PKR 163,395
                  </p>
                  <span
                    className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-tabular text-sm font-semibold"
                    style={{ color: "var(--color-profit)", backgroundColor: "var(--color-profit-bg)" }}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" /> +6.16%
                  </span>
                </div>
                {/* mini area chart */}
                <svg viewBox="0 0 320 90" className="h-24 w-full max-w-[360px]" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lpfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,70 L40,62 L80,66 L120,48 L160,52 L200,34 L240,40 L280,22 L320,16 L320,90 L0,90 Z"
                    fill="url(#lpfill)"
                  />
                  <path
                    d="M0,70 L40,62 L80,66 L120,48 L160,52 L200,34 L240,40 L280,22 L320,16"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              {/* metric strip */}
              <div className="mt-6 grid grid-cols-2 divide-x divide-border overflow-hidden rounded-xl border border-border md:grid-cols-4">
                {[
                  { l: "Cash", v: "14,209" },
                  { l: "Invested", v: "153,018" },
                  { l: "Market Value", v: "149,186" },
                  { l: "P&L", v: "+3,829", c: "var(--color-profit)" },
                ].map((m) => (
                  <div key={m.l} className="px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.l}</p>
                    <p className="mt-1 font-tabular text-lg font-semibold" style={m.c ? { color: m.c } : undefined}>
                      {m.v}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Features ───────────── */}
      <section id="features" className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">
              Everything you need to track the market
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From live prices to model portfolios — all in one calm, fast interface.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: LineChart, t: "Live KSE-100", d: "Real-time index and market-watch data straight from the exchange." },
              { icon: PieChart, t: "Portfolio analytics", d: "Allocation donuts, P&L by stock, and value-over-time charts." },
              { icon: Layers, t: "Model portfolios", d: "Design target allocations, rebalance, and run SIPs with one click." },
              { icon: Wallet, t: "Virtual trading", d: "Practice with virtual cash — buy, sell, and track without risk." },
              { icon: BarChart3, t: "Deep insights", d: "Performance, sector breakdowns, and what-if simulations." },
              { icon: ShieldCheck, t: "Your data, yours", d: "Synced privately to your own Google Drive. Sign in with Google." },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Stats band ───────────── */}
      <section className="border-t border-border">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-16 text-center md:grid-cols-4">
          {[
            { v: "500+", l: "PSX stocks" },
            { v: "Live", l: "KSE-100 index" },
            { v: "∞", l: "Model portfolios" },
            { v: "100%", l: "Free to use" },
          ].map((s) => (
            <div key={s.l}>
              <p className="font-tabular text-3xl font-semibold tracking-tight lg:text-4xl">{s.v}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Model portfolios highlight ───────────── */}
      <section id="models" className="border-t border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-primary" /> Model Portfolios
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight lg:text-4xl">
              Build, rebalance, and grow strategies
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Create target allocations across any PSX stocks, rebalance to market
              prices in one tap, run systematic investment plans, and track P&L per
              strategy — all kept in sync to your own Drive.
            </p>
            <Link
              href="/models"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Explore model portfolios <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-semibold">AKD Growth</p>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full">
              {["55%", "20%", "13%", "12%"].map((w, i) => (
                <div
                  key={i}
                  style={{ width: w, background: `var(--chart-${i + 1})` }}
                  className="h-full"
                />
              ))}
            </div>
            <div className="mt-5 space-y-2.5 text-sm">
              {[
                { s: "DGKC", p: "+12.1%", up: true },
                { s: "FABL", p: "+11.2%", up: true },
                { s: "GHNI", p: "-6.7%", up: false },
                { s: "MTL", p: "+8.0%", up: true },
              ].map((r) => (
                <div key={r.s} className="flex items-center justify-between">
                  <span className="font-medium">{r.s}</span>
                  <span
                    className="font-tabular text-sm font-medium"
                    style={{ color: r.up ? "var(--color-profit)" : "var(--color-loss)" }}
                  >
                    {r.p}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── CTA ───────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl font-semibold tracking-tight lg:text-5xl">
            Start tracking in seconds
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
            Sign in with Google and your portfolio is ready. No setup, no cost.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-7 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open the app
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ───────────── Footer ───────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" strokeWidth={2.4} />
            </div>
            <span className="text-sm font-medium">PSX Tracker</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Built for the Pakistan Stock Exchange · Not financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
