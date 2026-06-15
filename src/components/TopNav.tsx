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
  Layers,
  Sun,
  Moon,
  Info,
  Activity,
  Calculator,
  Upload,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { getMarketStatus } from "@/lib/market-status";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const primaryItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/models", label: "Models", icon: Layers },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/market", label: "Market", icon: TrendingUp },
  { href: "/performance", label: "Performance", icon: Activity },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const moreItems = [
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/what-if", label: "What-If", icon: Calculator },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/about", label: "About", icon: Info },
];

const allItems = [...primaryItems, ...moreItems];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const t = setInterval(() => setMarketStatus(getMarketStatus()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  const statusDot = {
    open: "bg-emerald-500",
    "pre-market": "bg-amber-500",
    "post-market": "bg-orange-500",
    closed: "bg-zinc-400",
  } as const;

  const moreActive = moreItems.some((m) => isActive(m.href));

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-5 lg:px-10">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <TrendingUp className="h-[18px] w-[18px] text-primary-foreground" strokeWidth={2.4} />
          </div>
          <span className="hidden text-[15px] font-semibold tracking-tight sm:block">
            PSX Tracker
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden flex-1 items-center gap-1 lg:flex">
          {primaryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors outline-none ${
                moreActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              More
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {moreItems.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  className="cursor-pointer"
                  onClick={() => router.push(item.href)}
                >
                  <item.icon className="h-4 w-4 text-muted-foreground mr-2" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right: market status + theme + user (desktop) */}
        <div className="ml-auto flex items-center gap-2 lg:gap-3">
          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground xl:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot[marketStatus.status]}`} />
            <span className="font-medium">{marketStatus.label}</span>
          </div>

          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors lg:flex"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger className="hidden items-center gap-2 rounded-lg p-1 pr-2 outline-none hover:bg-muted transition-colors lg:flex">
                {user.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.picture} alt={user.name} className="h-7 w-7 rounded-md" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-[11px] font-semibold text-primary">
                    {user.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-background lg:hidden">
          <div className="mx-auto max-w-[1600px] px-5 py-3">
            <div className="grid grid-cols-2 gap-1">
              {allItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === "dark" ? "Light" : "Dark"} mode
                </button>
              )}
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-muted transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
