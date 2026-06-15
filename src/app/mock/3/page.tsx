"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";

const series = Array.from({ length: 50 }, (_, i) => ({
  t: i,
  v: 50000 + i * 280 + Math.sin(i / 4) * 5000,
}));

const movers = [
  { s: "NRL", p: 17.88, up: true },
  { s: "DGKC", p: 0.46, up: true },
  { s: "GHNI", p: -6.66, up: false },
  { s: "GCWL", p: -18.24, up: false },
];

export default function Mock3() {
  return (
    <div className="min-h-dvh bg-[#08080c] text-white">
      {/* gradient mesh background */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute right-0 top-40 h-[400px] w-[400px] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-white/40">Welcome back, Faisal</p>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {/* hero (2 cols) */}
          <div className="lg:col-span-2 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
            <div className="flex items-start justify-between p-7">
              <div>
                <p className="text-sm text-white/40">Portfolio value</p>
                <p className="mt-1 font-tabular text-5xl font-semibold tracking-tight">PKR 163,395</p>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-sm font-semibold text-emerald-400">
                  <ArrowUpRight className="h-4 w-4" /> +6.16%
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ left: 0, right: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="m3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={["dataMin", "dataMax"]} hide />
                  <Tooltip contentStyle={{ background: "#13131a", border: "1px solid #2a2a35", borderRadius: 12, color: "#fff" }} formatter={(v) => [`PKR ${Number(v).toLocaleString()}`, "Value"]} labelFormatter={() => ""} />
                  <Area type="monotone" dataKey="v" stroke="#818cf8" strokeWidth={2.5} fill="url(#m3)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* right column stat tiles */}
          <div className="space-y-5">
            {[
              { l: "Total P&L", v: "+3,829", s: "+6.16% return", t: "text-emerald-400", g: "from-emerald-500/15" },
              { l: "Cash", v: "14,209", s: "Available", t: "text-white", g: "from-indigo-500/15" },
              { l: "KSE-100", v: "177,040", s: "+2.69% today", t: "text-emerald-400", g: "from-cyan-500/15" },
            ].map((m) => (
              <div key={m.l} className={`rounded-3xl border border-white/10 bg-gradient-to-br ${m.g} to-transparent p-6 backdrop-blur-xl`}>
                <p className="text-sm text-white/40">{m.l}</p>
                <p className={`mt-1 font-tabular text-3xl font-semibold ${m.t}`}>{m.v}</p>
                <p className="mt-1 text-xs text-white/40">{m.s}</p>
              </div>
            ))}
          </div>
        </div>

        {/* movers row */}
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {movers.map((m) => (
            <div key={m.s} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <p className="font-semibold">{m.s}</p>
              <div className={`mt-1 flex items-center gap-1 text-sm font-semibold ${m.up ? "text-emerald-400" : "text-rose-400"}`}>
                {m.up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {m.p}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
