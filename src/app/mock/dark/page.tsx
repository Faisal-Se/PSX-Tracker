"use client";

import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Bell,
  ChevronRight,
  Layers,
  Wallet,
  TrendingUp,
} from "lucide-react";

// ── Rich DARK · dense full-width grid · motion · compact hero chart ──

const series = Array.from({ length: 60 }, (_, i) => ({
  t: i,
  v: Math.round(50000 + i * 280 + Math.sin(i / 5) * 4000 + Math.cos(i / 2.3) * 1800),
}));
const ranges = ["1D", "1W", "1M", "3M", "1Y", "ALL"];
const alloc = [
  { name: "DGKC", value: 30, c: "#10b981" },
  { name: "FABL", value: 22, c: "#22d3ee" },
  { name: "GHNI", value: 18, c: "#a78bfa" },
  { name: "MTL", value: 14, c: "#fbbf24" },
  { name: "Cash", value: 16, c: "#475569" },
];
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
  { s: "GCWLR", p: 30 },
  { s: "STPL", p: 11.85 },
  { s: "SLM", p: 10.03 },
  { s: "NRL", p: 17.88 },
];
const losers = [
  { s: "GCWL", p: -18.24 },
  { s: "AIRLINK", p: -14.58 },
  { s: "GHNI", p: -6.66 },
  { s: "GCIL", p: -6.44 },
];

function spk(seed: number) {
  return Array.from({ length: 18 }, (_, i) => 40 + Math.sin((i + seed) / 3) * 12 + i * (seed % 3));
}
function MiniSpark({ data, up }: { data: number[]; up: boolean }) {
  const min = Math.min(...data), max = Math.max(...data), r = max - min || 1;
  const id = up ? "gp" : "rp";
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 72},${22 - ((v - min) / r) * 18}`).join(" ");
  return (
    <svg width="72" height="26" viewBox="0 0 72 26" className="shrink-0">
      <polyline points={pts} fill="none" stroke={`url(#${id})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="gp" x1="0" x2="1"><stop stopColor="#34d399" /><stop offset="1" stopColor="#10b981" /></linearGradient>
        <linearGradient id="rp" x1="0" x2="1"><stop stopColor="#fb7185" /><stop offset="1" stopColor="#f43f5e" /></linearGradient>
      </defs>
    </svg>
  );
}

// count-up hook
function useCountUp(target: number, ms = 900) {
  const [n, setN] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return n;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export default function MockDark() {
  const [range, setRange] = useState("1M");
  const val = useCountUp(163395);

  return (
    <div className="min-h-dvh bg-[#0a0b0d] text-white">
      <style>{`@keyframes draw{from{stroke-dashoffset:1400}to{stroke-dashoffset:0}}
      .rise{animation:rise .5s cubic-bezier(.22,1,.36,1) both}
      @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#0a0b0d]/90 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 shadow-lg shadow-emerald-500/40">
              <TrendingUp className="h-5 w-5 text-black" strokeWidth={3} />
            </div>
            <span className="font-semibold tracking-tight">PSX Tracker</span>
          </div>
          <nav className="hidden gap-6 text-sm text-white/45 md:flex">
            {["Dashboard", "Models", "Portfolio", "Market"].map((n, i) => (
              <span key={n} className={i === 0 ? "font-medium text-white" : "cursor-pointer hover:text-white"}>{n}</span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-white/50">
          <Search className="h-5 w-5 cursor-pointer hover:text-white" />
          <Bell className="h-5 w-5 cursor-pointer hover:text-white" />
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* TOP GRID: hero chart (2/3) + allocation + stats (1/3) */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* hero */}
          <div className="rise overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-6 lg:col-span-2">
            <p className="text-sm font-medium text-white/40">Portfolio value</p>
            <h1 className="mt-1 font-tabular text-5xl font-semibold tracking-tight">PKR {fmt(val)}</h1>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-sm font-semibold text-emerald-400">
              <ArrowUpRight className="h-4 w-4" /> +9,478 (6.16%) Today
            </div>
            <div className="mt-4 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="hd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide /><YAxis domain={["dataMin - 4000", "dataMax + 4000"]} hide />
                  <Tooltip contentStyle={{ background: "#15161a", border: "1px solid #2a2c32", borderRadius: 12, color: "#fff" }} formatter={(v) => [`PKR ${fmt(Number(v))}`, "Value"]} labelFormatter={() => ""} />
                  <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2.5} fill="url(#hd)" dot={false} activeDot={{ r: 4 }} isAnimationActive animationDuration={1100} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-1">
              {ranges.map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${range === r ? "bg-emerald-500/15 text-emerald-400" : "text-white/40 hover:text-white"}`}>{r}</button>
              ))}
            </div>
          </div>

          {/* allocation donut */}
          <div className="rise rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6" style={{ animationDelay: ".05s" }}>
            <p className="mb-3 text-sm font-semibold">Allocation</p>
            <div className="flex items-center gap-4">
              <div className="h-28 w-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={alloc} dataKey="value" innerRadius={36} outerRadius={54} paddingAngle={3} stroke="none" isAnimationActive animationDuration={900}>
                      {alloc.map((a) => <Cell key={a.name} fill={a.c} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {alloc.map((a) => (
                  <div key={a.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: a.c }} />{a.name}</span>
                    <span className="font-tabular text-white/50">{a.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* STATS strip — 4 mini cards */}
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { l: "Invested", v: "153,018", i: Wallet, c: "" },
            { l: "Cash", v: "14,209", i: Wallet, c: "" },
            { l: "Today's P&L", v: "+3,829", i: ArrowUpRight, c: "text-emerald-400" },
            { l: "Total return", v: "+6.16%", i: TrendingUp, c: "text-emerald-400" },
          ].map((m, i) => (
            <div key={m.l} className="rise rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4" style={{ animationDelay: `${0.08 + i * 0.04}s` }}>
              <p className="text-xs font-medium uppercase tracking-wide text-white/35">{m.l}</p>
              <p className={`mt-1 font-tabular text-xl font-semibold ${m.c}`}>{m.v}</p>
            </div>
          ))}
        </div>

        {/* MID GRID: holdings (2/3) + side column models+movers (1/3) */}
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {/* holdings */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 lg:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-semibold">Holdings</h2>
              <button className="flex items-center gap-0.5 text-sm font-medium text-emerald-400">View all <ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {holdings.map((h) => (
                <div key={h.s} className="flex cursor-pointer items-center justify-between py-3 transition-colors hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-xs font-bold">{h.s.slice(0, 2)}</div>
                    <div><p className="font-semibold leading-tight">{h.s}</p><p className="text-xs text-white/40">{h.n}</p></div>
                  </div>
                  <div className="flex items-center gap-5">
                    <MiniSpark data={h.spark} up={h.up} />
                    <div className="text-right">
                      <p className="font-tabular font-semibold">PKR {fmt(h.v)}</p>
                      <p className={`font-tabular text-sm font-medium ${h.up ? "text-emerald-400" : "text-rose-400"}`}>{h.up ? "+" : ""}{h.p}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* side column */}
          <div className="space-y-5">
            {/* KSE strip */}
            <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5">
              <span className="flex items-center gap-2 text-sm text-white/60">
                <span className="relative flex h-2 w-2"><span className="absolute h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="h-2 w-2 rounded-full bg-emerald-400" /></span>
                KSE-100
              </span>
              <span className="flex items-center gap-2"><span className="font-tabular font-semibold">177,040</span><span className="font-tabular text-sm font-semibold text-emerald-400">+2.69%</span></span>
            </div>
            {/* models */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <div className="mb-2 flex items-center gap-2"><Layers className="h-4 w-4 text-emerald-400" /><h3 className="text-sm font-semibold">Model Portfolios</h3></div>
              <div className="space-y-2">
                {models.map((m) => (
                  <div key={m.name} className="flex cursor-pointer items-center justify-between rounded-xl bg-white/[0.03] p-3 hover:bg-white/[0.06]">
                    <div><p className="text-sm font-semibold">{m.name}</p><p className={`font-tabular text-xs ${m.up ? "text-emerald-400" : "text-rose-400"}`}>{m.up ? "+" : ""}{m.p}%</p></div>
                    <MiniSpark data={m.spark} up={m.up} />
                  </div>
                ))}
              </div>
            </div>
            {/* movers */}
            <div className="grid grid-cols-2 gap-4">
              <Movers title="Gainers" rows={gainers} up />
              <Movers title="Losers" rows={losers} up={false} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Movers({ title, rows, up }: { title: string; rows: { s: string; p: number }[]; up: boolean }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">{title}</h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.s} className="flex items-center justify-between text-sm">
            <span className="font-medium">{r.s}</span>
            <span className={`font-tabular font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>{up ? "+" : ""}{r.p}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
