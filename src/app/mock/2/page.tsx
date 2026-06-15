"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ArrowUpRight, Plus, Repeat, Sparkles, Layers } from "lucide-react";

// Revolut-style: vibrant gradient hero card, bold rounded tiles, colorful.
const spark = Array.from({ length: 30 }, (_, i) => ({
  v: 50 + Math.sin(i / 4) * 18 + i * 1.5,
}));
const alloc = [
  { name: "DGKC", value: 30, c: "#8b5cf6" },
  { name: "FABL", value: 22, c: "#3b82f6" },
  { name: "GHNI", value: 18, c: "#06b6d4" },
  { name: "Cash", value: 30, c: "#64748b" },
];

export default function Mock2() {
  return (
    <div className="min-h-dvh bg-[#0b0b12] text-white">
      <div className="mx-auto max-w-md px-5 py-8 sm:max-w-2xl lg:max-w-4xl">
        {/* header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-white/40">Good evening</p>
            <p className="text-lg font-semibold">Faisal</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
        </div>

        {/* vibrant gradient hero card */}
        <div className="relative overflow-hidden rounded-3xl p-6 shadow-2xl shadow-violet-900/40"
          style={{ background: "linear-gradient(135deg,#6d28d9 0%,#4f46e5 45%,#0ea5e9 100%)" }}>
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          <p className="text-sm font-medium text-white/70">Total balance</p>
          <p className="mt-1 font-tabular text-5xl font-bold tracking-tight">PKR 163,395</p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-sm font-semibold">
            <ArrowUpRight className="h-4 w-4" /> +6.16% this month
          </div>
          <div className="mt-4 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <defs>
                  <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#fff" strokeWidth={2} fill="url(#m2)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* action tiles */}
        <div className="mt-5 grid grid-cols-4 gap-3">
          {[
            { i: Plus, l: "Add" },
            { i: Repeat, l: "Trade" },
            { i: Layers, l: "Models" },
            { i: Sparkles, l: "SIP" },
          ].map((a) => (
            <button key={a.l} className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 py-4 transition-colors hover:bg-white/10">
              <a.i className="h-5 w-5 text-violet-300" />
              <span className="text-xs font-medium text-white/70">{a.l}</span>
            </button>
          ))}
        </div>

        {/* colorful metric tiles */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { l: "Invested", v: "153,018", g: "from-blue-500/20 to-blue-500/5", t: "text-blue-300" },
            { l: "Today P&L", v: "+3,829", g: "from-emerald-500/20 to-emerald-500/5", t: "text-emerald-300" },
            { l: "Cash", v: "14,209", g: "from-amber-500/20 to-amber-500/5", t: "text-amber-300" },
            { l: "KSE-100", v: "177,040", g: "from-fuchsia-500/20 to-fuchsia-500/5", t: "text-fuchsia-300" },
          ].map((m) => (
            <div key={m.l} className={`rounded-2xl border border-white/5 bg-gradient-to-br ${m.g} p-4`}>
              <p className="text-xs text-white/50">{m.l}</p>
              <p className={`mt-1 font-tabular text-xl font-bold ${m.t}`}>{m.v}</p>
            </div>
          ))}
        </div>

        {/* allocation donut card */}
        <div className="mt-5 flex items-center gap-6 rounded-3xl border border-white/5 bg-white/[0.03] p-6">
          <div className="h-32 w-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={alloc} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={3} stroke="none">
                  {alloc.map((a) => <Cell key={a.name} fill={a.c} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2.5">
            {alloc.map((a) => (
              <div key={a.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.c }} />
                  <span className="text-sm font-medium">{a.name}</span>
                </div>
                <span className="font-tabular text-sm text-white/60">{a.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
