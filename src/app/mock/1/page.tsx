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
import { ArrowUpRight, ArrowDownRight, Search, Bell } from "lucide-react";

// Robinhood-style: one giant number, one massive hero chart, vibrant green.
const series = Array.from({ length: 60 }, (_, i) => {
  const base = 50000 + i * 280;
  const wobble = Math.sin(i / 5) * 4000 + Math.cos(i / 2.3) * 1800;
  return { t: i, v: Math.round(base + wobble) };
});
const ranges = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

const holdings = [
  { s: "DGKC", n: "D.G. Khan Cement", v: 19762, p: 0.46, up: true },
  { s: "FABL", n: "Faysal Bank", v: 18222, p: 0.11, up: true },
  { s: "GHNI", n: "Ghandhara", v: 17070, p: -6.66, up: false },
  { s: "MTL", n: "Millat Tractors", v: 15804, p: -0.93, up: false },
  { s: "NRL", n: "National Refinery", v: 11097, p: 17.88, up: true },
];

export default function Mock1() {
  const [range, setRange] = useState("1M");
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      {/* top bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/5 bg-[#0a0a0a]/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
            <ArrowUpRight className="h-5 w-5 text-black" strokeWidth={3} />
          </div>
          <span className="font-semibold tracking-tight">PSX</span>
        </div>
        <div className="flex items-center gap-4 text-white/50">
          <Search className="h-5 w-5" />
          <Bell className="h-5 w-5" />
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
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
        <div className="mt-8 h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis domain={["dataMin - 4000", "dataMax + 4000"]} hide />
              <Tooltip
                contentStyle={{ background: "#161616", border: "1px solid #262626", borderRadius: 12, color: "#fff" }}
                formatter={(v) => [`PKR ${Number(v).toLocaleString()}`, "Value"]}
                labelFormatter={() => ""}
              />
              <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2.5} fill="url(#m1)" dot={false} />
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

        {/* holdings list */}
        <h2 className="mt-12 mb-2 text-lg font-semibold">Holdings</h2>
        <div className="divide-y divide-white/5">
          {holdings.map((h) => (
            <div key={h.s} className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-sm font-bold">
                  {h.s.slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold">{h.s}</p>
                  <p className="text-sm text-white/40">{h.n}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-tabular font-semibold">PKR {h.v.toLocaleString()}</p>
                <p className={`font-tabular text-sm font-medium ${h.up ? "text-emerald-400" : "text-rose-400"}`}>
                  {h.up ? "+" : ""}{h.p}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
