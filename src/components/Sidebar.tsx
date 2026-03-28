"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Eye,
  ArrowLeftRight,
  BarChart3,
  TrendingUp,
  LogOut,
  CircleDot,
  Layers,
  Sun,
  Moon,
  Info,
  Activity,
  Calculator,
  Upload,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { getMarketStatus } from "@/lib/market-status";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/market", label: "Market", icon: TrendingUp },
  { href: "/models", label: "Model Portfolios", icon: Layers },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/performance", label: "Performance", icon: Activity },
  { href: "/what-if", label: "What-If", icon: Calculator },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/about", label: "About", icon: Info },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useStore();
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(getMarketStatus());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  const statusColors = {
    open: "bg-emerald-500",
    "pre-market": "bg-amber-500",
    "post-market": "bg-orange-500",
    closed: "bg-zinc-400",
  };

  const statusTextColors = {
    open: "text-emerald-400",
    "pre-market": "text-amber-400",
    "post-market": "text-orange-400",
    closed: "text-zinc-500",
  };

  return (
    <aside className="dark fixed left-0 top-0 z-40 h-screen w-[260px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col border-r border-white/5">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-breathe">
            <TrendingUp className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-white">
              PSX Tracker
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/35">
              Pakistan Stock Exchange
            </p>
          </div>
        </div>
      </div>

      {/* Market Status */}
      <div className="mx-4 mb-4 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <CircleDot
                className={`h-3.5 w-3.5 ${statusTextColors[marketStatus.status]}`}
              />
              {marketStatus.status === "open" && (
                <span className="absolute inset-0 h-3.5 w-3.5 rounded-full bg-emerald-400/40 pulse-dot" />
              )}
            </div>
            <span className="text-xs font-semibold text-white/85">
              {marketStatus.label}
            </span>
          </div>
          <span
            className={`h-1.5 w-1.5 rounded-full ${statusColors[marketStatus.status]}`}
          />
        </div>
        <p className="text-[10px] text-white/35 mt-1 pl-5.5">
          {marketStatus.nextEvent}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/25 px-3 mb-2">
          Menu
        </p>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-white shadow-md shadow-emerald-500/10 border border-emerald-500/20"
                  : "text-white/50 hover:text-white/90 hover:bg-white/8"
              }`}
            >
              <item.icon
                className={`h-[18px] w-[18px] transition-colors ${
                  isActive
                    ? "text-emerald-400"
                    : "text-white/35 group-hover:text-white/70"
                }`}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="px-3 mt-auto mb-2">
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-white/50 hover:text-white/90 hover:bg-white/8 transition-all duration-200"
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px] text-white/35" strokeWidth={1.8} />
            ) : (
              <Moon className="h-[18px] w-[18px] text-white/35" strokeWidth={1.8} />
            )}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        )}
      </div>

      {/* User Section */}
      <div className="p-3">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="h-8 w-8 rounded-lg shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400/25 to-cyan-400/25 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white/90 truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-white/35 truncate">
                {user.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
