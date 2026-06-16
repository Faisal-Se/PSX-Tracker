"use client";

import {
  LineChart,
  Layers,
  ArrowRightLeft,
  ShieldCheck,
  BarChart3,
  TrendingUp,
} from "lucide-react";

/** Instagram glyph — lucide-react v1 doesn't export `Instagram`. */
function Instagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

const features = [
  {
    icon: LineChart,
    title: "Live PSX Data",
    desc: "KSE-100, full market watch and per-stock history — straight from the source.",
  },
  {
    icon: Layers,
    title: "Model Portfolios",
    desc: "Target allocations with rebalance, SIP and bulk-trade tooling.",
  },
  {
    icon: ArrowRightLeft,
    title: "Virtual Trading",
    desc: "Practise BUY / SELL with virtual cash across multiple portfolios.",
  },
  {
    icon: ShieldCheck,
    title: "Private by Design",
    desc: "Your data lives in your own Google Drive — never on a server.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    desc: "Allocation, sector and P&L breakdowns with CSV exports.",
  },
  {
    icon: TrendingUp,
    title: "What-If Simulator",
    desc: "Model hypothetical investments before you commit a rupee.",
  },
];

const techStack = [
  "React",
  "Recharts",
  "Google Drive API",
  "PSX Live Data",
  "PWA",
  "Service Workers",
];

const stats = [
  { value: "14", label: "Screens" },
  { value: "500+", label: "Stocks" },
  { value: "100%", label: "Yours" },
];

export default function AboutPage() {
  return (
    <>
      {/* Page Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] font-medium text-ink-3">
            The story &amp; the maker
          </div>
          <h1 className="text-[26px] font-bold tracking-[-.03em]">About</h1>
        </div>
      </div>

      {/* Hero card */}
      <section className="relative mb-[18px] overflow-hidden rounded-2xl border border-line bg-card p-[30px] shadow-card">
        <div className="absolute -right-16 -top-24 h-[260px] w-[260px] rounded-full bg-brand-50" />
        <div className="relative flex flex-wrap items-start justify-between gap-7">
          <div className="max-w-[580px]">
            <div className="mb-3 text-[12px] font-bold tracking-[.1em] text-brand">
              DESIGNED &amp; BUILT BY
            </div>
            <div
              className="text-[66px] leading-[.95]"
              style={{ fontFamily: "var(--font-signature), cursive" }}
            >
              Faisal Qayyum
            </div>
            <div className="mb-[18px] mt-3 text-[14px] font-medium text-ink-2">
              Product Designer &amp; Developer
            </div>
            <p className="text-[14.5px] leading-[1.65] text-ink-2">
              I built PSX Tracker because I wanted a fast, calm and genuinely
              beautiful way to follow the Pakistan Stock Exchange and practise
              investing — without handing my data to anyone.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <a
                href="https://instagram.com/faisalqayyum"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center gap-2 rounded-[11px] bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,.25)] hover:brightness-105"
              >
                <Instagram className="h-4 w-4" />
                @faisalqayyum
              </a>
              <a
                href="mailto:asadqayyum.rec@gmail.com"
                className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04]"
              >
                Get in touch
              </a>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-brand to-[#3B82F6] text-[34px] font-bold text-white shadow-[0_10px_30px_rgba(37,99,235,.25)]">
              FQ
            </div>
          </div>
        </div>
      </section>

      {/* What's inside */}
      <div className="mb-3.5 px-0.5 text-[13px] font-bold tracking-[.06em] text-ink-3">
        WHAT&apos;S INSIDE
      </div>
      <div className="mb-[18px] grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-line bg-card p-[22px] shadow-card"
          >
            <div className="mb-3.5 grid h-9 w-9 place-items-center rounded-[11px] bg-brand/10 text-brand">
              <feature.icon className="h-[18px] w-[18px]" />
            </div>
            <div className="mb-1.5 text-[14.5px] font-bold">{feature.title}</div>
            <div className="text-[12.5px] leading-[1.5] text-ink-3">
              {feature.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Built with + stats */}
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
          <div className="mb-3.5 text-[13px] font-semibold tracking-[.04em] text-ink-3">
            BUILT WITH
          </div>
          <div className="flex flex-wrap gap-2">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-line bg-canvas px-3 py-1.5 text-[12.5px] font-semibold text-ink-2"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-around rounded-2xl border border-line bg-card p-[22px] text-center shadow-card">
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className="num text-[26px] font-bold tracking-[-.02em] text-brand">
                {stat.value}
              </div>
              <div className="mt-0.5 text-[12px] text-ink-3">{stat.label}</div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
