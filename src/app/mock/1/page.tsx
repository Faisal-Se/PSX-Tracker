"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Bell,
  ChevronRight,
} from "lucide-react";

// ── Robinhood-style complete dashboard · flat black · no background effects ──

const series = Array.from({ length: 60 }, (_, i) => {
  const base = 50000 + i * 280;
  const wobble = Math.sin(i / 5) * 4000 + Math.cos(i / 2.3) * 1800;
  return { t: i, v: Math.round(base + wobble) };
});
const ranges = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

const holdings = [
  { s: "DGKC", n: "D.G. Khan Cement", v: 19762, p: 0.46, up: true, spark: spk(1) },
  { s: "FABL", n: "Faysal Bank", v: 18222, p: 0.11, up: true, spark: spk(2) },
  { s: "GHNI", n: "Ghandhara Ind.", v: 17070, p: -6.66, up: false, spark: spk(3) },
  { s: "MTL", n: "Millat Tractors", v: 15804, p: -0.93, up: false, spark: spk(4) },
  { s: "NRL", n: "National Refinery", v: 11097, p: 17.88, up: true, spark: spk(5) },
];

const models = [
  { name: "AKD Growth", v: 163395, p: 6.16, up: true, spark: spk(6) },
  { name: "Dividend Core", v: 88210, p: -1.2, up: false, spark: spk(7) },
];

const gainers = [
  { s: "GCWLR", v: 1.01, p: 10000 },
  { s: "STPL", v: 9.44, p: 11.85 },
  { s: "SLM", v: 21.95, p: 10.03 },
  { s: "NRL", v: 369.9, p: 17.88 },
];
const losers = [
  { s: "GCWL", v: 16.93, p: -18.24 },
  { s: "AIRLINK", v: 153.04, p: -14.58 },
  { s: "GHNI", v: 898.42, p: -6.66 },
  { s: "GCIL", v: 29.51, p: -6.44 },
];
const watchlist = [
  { s: "OGDC", v: 248.5, p: 1.4, up: true },
  { s: "LUCK", v: 1042.0, p: -0.6, up: false },
  { s: "ENGRO", v: 312.7, p: 2.1, up: true },
];

function spk(seed: number) {
  return Array.from({ length: 18 }, (_, i) => 40 + Math.sin((i + seed) / 3) * 12 + i * (seed % 3));
}

function MiniSpark({ data, up }: { data: number[]; up: boolean }) {
  const min = Math.min(...data),
    max = Math.max(...data),
    r = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 64},${20 - ((v - min) / r) * 18}`)
    .join(" ");
  return (
    <svg width="64" height="22" viewBox="0 0 64 22" className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "#10b981" : "#f43f5e"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US");

export default function Mock1() {
  const [range, setRange] = useState("1M");

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      {/* top bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#0a0a0a]/90 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
              <ArrowUpRight className="h-5 w-5 text-black" strokeWidth={3} />
            </div>
            <span className="font-semibold tracking-tight">PSX Tracker</span>
          </div>
          <nav className="hidden gap-6 text-sm text-white/45 md:flex">
            {["Dashboard", "Models", "Portfolio", "Market"].map((n, i) => (
              <span key={n} className={i === 0 ? "font-medium text-white" : "cursor-pointer hover:text-white"}>
                {n}
              </span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-white/50">
          <Search className="h-5 w-5 cursor-pointer hover:text-white" />
          <Bell className="h-5 w-5 cursor-pointer hover:text-white" />
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-28">
        {/* giant value */}
        <div className="pt-12">
          <p className="text-sm font-medium text-white/40">Portfolio value</p>
          <h1 className="mt-2 font-tabular text-6xl font-semibold tracking-tight lg:text-7xl">
            PKR 163,395
          </h1>
          <div className="mt-3 flex items-center gap-2 text-emerald-400">
            <ArrowUpRight className="h-5 w-5" />
            <span className="font-tabular text-lg font-medium">+9,478 (6.16%)</span>
            <span className="text-white/30">Today</span>
          </div>
        </div>

        {/* huge hero chart */}
        <div className="mt-8 h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis domain={["dataMin - 4000", "dataMax + 4000"]} hide />
              <Tooltip
                contentStyle={{ background: "#161616", border: "1px solid #262626", borderRadius: 12, color: "#fff" }}
                formatter={(v) => [`PKR ${fmt(Number(v))}`, "Value"]}
                labelFormatter={() => ""}
              />
              <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2.5} fill="url(#m1)" dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* range pills */}
        <div className="mt-2 flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                range === r ? "bg-emerald-500/15 text-emerald-400" : "text-white/40 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* stats row */}
        <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-y border-white/[0.06] py-7 sm:grid-cols-4">
          {[
            { l: "Invested", v: "153,018" },
            { l: "Cash", v: "14,209" },
            { l: "Today's P&L", v: "+3,829", c: "text-emerald-400" },
            { l: "Total return", v: "+6.16%", c: "text-emerald-400" },
          ].map((m) => (
            <div key={m.l}>
              <p className="text-xs font-medium uppercase tracking-wide text-white/35">{m.l}</p>
              <p className={`mt-1.5 font-tabular text-2xl font-semibold ${m.c ?? ""}`}>{m.v}</p>
            </div>
          ))}
        </div>

        {/* KSE-100 strip */}
        <div className="mt-8 flex items-center justify-between rounded-2xl bg-white/[0.03] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-sm font-medium text-white/60">KSE-100 Index</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-tabular text-lg font-semibold">177,040</span>
            <span className="font-tabular text-sm font-semibold text-emerald-400">+2.69%</span>
          </div>
        </div>

        {/* Model portfolios */}
        <Section title="Model Portfolios" action="View all" />
        <div className="grid gap-3 sm:grid-cols-2">
          {models.map((m) => (
            <div key={m.name} className="flex cursor-pointer items-center justify-between rounded-2xl bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.06]">
              <div>
                <p className="font-semibold">{m.name}</p>
                <p className="mt-0.5 font-tabular text-xl font-semibold">PKR {fmt(m.v)}</p>
                <p className={`font-tabular text-sm font-medium ${m.up ? "text-emerald-400" : "text-rose-400"}`}>
                  {m.up ? "+" : ""}{m.p}%
                </p>
              </div>
              <MiniSpark data={m.spark} up={m.up} />
            </div>
          ))}
        </div>

        {/* Holdings */}
        <Section title="Holdings" action="View all" />
        <div className="divide-y divide-white/[0.06]">
          {holdings.map((h) => (
            <div key={h.s} className="flex cursor-pointer items-center justify-between py-4 transition-opacity hover:opacity-80">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-sm font-bold">
                  {h.s.slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold">{h.s}</p>
                  <p className="text-sm text-white/40">{h.n}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <MiniSpark data={h.spark} up={h.up} />
                <div className="text-right">
                  <p className="font-tabular font-semibold">PKR {fmt(h.v)}</p>
                  <p className={`font-tabular text-sm font-medium ${h.up ? "text-emerald-400" : "text-rose-400"}`}>
                    {h.up ? "+" : ""}{h.p}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Movers: gainers / losers */}
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <MoverCol title="Top Gainers" rows={gainers} positive />
          <MoverCol title="Top Losers" rows={losers} positive={false} />
        </div>

        {/* Watchlist */}
        <Section title="Watchlist" action="Edit" />
        <div className="divide-y divide-white/[0.06]">
          {watchlist.map((w) => (
            <div key={w.s} className="flex cursor-pointer items-center justify-between py-3.5 transition-opacity hover:opacity-80">
              <span className="font-semibold">{w.s}</span>
              <div className="flex items-center gap-5">
                <span className="font-tabular text-white/70">{w.v.toFixed(2)}</span>
                <span className={`font-tabular text-sm font-semibold ${w.up ? "text-emerald-400" : "text-rose-400"}`}>
                  {w.up ? "+" : ""}{w.p}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Section({ title, action }: { title: string; action: string }) {
  return (
    <div className="mt-12 mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      <button className="flex items-center gap-0.5 text-sm font-medium text-emerald-400 hover:text-emerald-300">
        {action} <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function MoverCol({
  title,
  rows,
  positive,
}: {
  title: string;
  rows: { s: string; v: number; p: number }[];
  positive: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {positive ? (
          <ArrowUpRight className="h-4 w-4 text-emerald-400" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-rose-400" />
        )}
        <h3 className="text-sm font-semibold text-white/60">{title}</h3>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {rows.map((r, i) => (
          <div key={r.s} className="flex cursor-pointer items-center justify-between py-3 transition-opacity hover:opacity-80">
            <div className="flex items-center gap-3">
              <span className="w-4 font-tabular text-xs text-white/30">{i + 1}</span>
              <span className="font-semibold">{r.s}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-tabular text-sm text-white/60">{r.v.toFixed(2)}</span>
              <span
                className={`min-w-[68px] rounded-md px-2 py-0.5 text-right font-tabular text-sm font-semibold ${
                  positive ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                }`}
              >
                {positive ? "+" : ""}{r.p}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
