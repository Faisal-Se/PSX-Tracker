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
    open: "text-emerald-500",
    "pre-market": "text-amber-500",
    "post-market": "text-orange-500",
    closed: "text-muted-foreground",
  };

  return (
    <aside className="left-0 top-0 z-40 h-dvh w-[260px] bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp className="h-[18px] w-[18px] text-primary-foreground" strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="text-[14px] font-semibold tracking-tight text-sidebar-accent-foreground">
              PSX Tracker
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/60">
              Pakistan Stock Exchange
            </p>
          </div>
        </div>
      </div>

      {/* Market Status */}
      <div className="mx-3 mb-4 px-3 py-2.5 rounded-lg bg-sidebar-accent border border-sidebar-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <CircleDot
                className={`h-3.5 w-3.5 ${statusTextColors[marketStatus.status]}`}
              />
              {marketStatus.status === "open" && (
                <span className="absolute inset-0 h-3.5 w-3.5 rounded-full bg-emerald-500/40 pulse-dot" />
              )}
            </div>
            <span className="text-xs font-medium text-sidebar-accent-foreground">
              {marketStatus.label}
            </span>
          </div>
          <span
            className={`h-1.5 w-1.5 rounded-full ${statusColors[marketStatus.status]}`}
          />
        </div>
        <p className="text-[10px] text-sidebar-foreground/70 mt-1 pl-5.5">
          {marketStatus.nextEvent}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45 px-2.5 mb-2 mt-1">
          Menu
        </p>
        <div className="space-y-px">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-2.5 pl-3.5 pr-2.5 h-8 rounded-md text-[13px] transition-colors duration-150 ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 font-normal"
                }`}
              >
                {/* Active left indicator bar (Linear signature) */}
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-sidebar-primary transition-all duration-200 ${
                    isActive ? "h-4 opacity-100" : "h-0 opacity-0"
                  }`}
                />
                <item.icon
                  className={`h-[16px] w-[16px] shrink-0 transition-colors ${
                    isActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground"
                  }`}
                  strokeWidth={2}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Theme Toggle */}
      <div className="px-3 shrink-0 mb-2">
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60 transition-colors duration-150"
          >
            {theme === "dark" ? (
              <Sun className="h-[17px] w-[17px] text-sidebar-foreground/70" strokeWidth={1.9} />
            ) : (
              <Moon className="h-[17px] w-[17px] text-sidebar-foreground/70" strokeWidth={1.9} />
            )}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        )}
      </div>

      {/* User Section */}
      <div className="p-3 shrink-0 border-t border-sidebar-border">
        {user && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="h-8 w-8 rounded-lg shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-sidebar-foreground/70 truncate">
                {user.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-destructive transition-colors"
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
