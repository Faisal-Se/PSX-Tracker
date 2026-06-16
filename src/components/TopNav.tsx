"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Sun,
  Moon,
  ChevronDown,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useStore } from "@/store/useStore";
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
  { href: "/dashboard", label: "Dashboard" },
  { href: "/models", label: "Models" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/market", label: "Market" },
  { href: "/performance", label: "Performance" },
  { href: "/analytics", label: "Analytics" },
];

const moreItems = [
  { href: "/watchlist", label: "Watchlist" },
  { href: "/transactions", label: "Transactions" },
  { href: "/what-if", label: "What-If" },
  { href: "/import", label: "Import" },
  { href: "/about", label: "About" },
];

const allItems = [...primaryItems, ...moreItems];

/** Brand mark — trending-up + arrow, matches the design handoff svg. */
function BrandMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 16 L9 10 L13 13 L20 5"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 5 V10 M20 5 H15"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser } = useStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => setMounted(true), []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (q) router.push(`/stock/${encodeURIComponent(q)}`);
  };

  const moreActive = moreItems.some((m) => isActive(m.href));
  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "FQ";

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-[62px] max-w-[1340px] items-center gap-7 px-6">
        {/* Brand */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-[#4f8bf7] to-[#1d4ed8] shadow-[0_4px_12px_rgba(37,99,235,.3)]">
            <BrandMark />
          </span>
          <span className="hidden text-[16px] font-bold tracking-[-.02em] sm:block">
            PSX<span className="font-medium text-ink-3"> Tracker</span>
          </span>
        </Link>

        {/* Primary nav (desktop) */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {primaryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-9 items-center rounded-[9px] px-3.5 text-[13.5px] transition-colors ${
                isActive(item.href)
                  ? "bg-ink/[.04] font-semibold text-ink"
                  : "font-medium text-ink-2 hover:bg-ink/[.03]"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex h-9 items-center gap-1 rounded-[9px] px-2.5 text-[13.5px] outline-none transition-colors ${
                moreActive
                  ? "bg-ink/[.04] font-semibold text-ink"
                  : "font-medium text-ink-2 hover:bg-ink/[.03]"
              }`}
            >
              More
              <ChevronDown className="h-3 w-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {moreItems.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  className="cursor-pointer"
                  onClick={() => router.push(item.href)}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex-1" />

        {/* Right cluster */}
        <div className="flex items-center gap-2.5">
          <form onSubmit={onSearch} className="relative hidden items-center md:flex">
            <Search className="absolute left-3 h-[15px] w-[15px] opacity-50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stocks…"
              className="h-[38px] w-[180px] rounded-[10px] border border-line bg-canvas pl-8 pr-3 text-[13px] text-ink outline-none transition-[width] focus:w-[220px] focus:border-brand"
            />
          </form>

          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-line bg-canvas text-ink-2 hover:bg-ink/[.04]"
              title="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-[17px] w-[17px]" />
              ) : (
                <Moon className="h-[17px] w-[17px]" />
              )}
            </button>
          )}

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-[38px] items-center gap-2 rounded-[10px] pl-1 pr-1.5 outline-none hover:bg-ink/[.04]">
                {user.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="h-[30px] w-[30px] rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-[12px] font-semibold text-white">
                    {initials}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-ink-3">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-loss-strong focus:text-loss-strong"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="grid h-[38px] w-[38px] place-items-center rounded-[10px] text-ink hover:bg-ink/[.04] lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-line bg-card lg:hidden">
          <div className="mx-auto max-w-[1340px] px-6 py-3">
            <div className="grid grid-cols-2 gap-1">
              {allItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-[9px] px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-ink/[.04] text-ink"
                      : "text-ink-2 hover:bg-ink/[.03]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center gap-2 rounded-[9px] px-3 py-2 text-sm font-medium text-ink-2 hover:bg-ink/[.03]"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  {theme === "dark" ? "Light" : "Dark"} mode
                </button>
              )}
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-[9px] px-3 py-2 text-sm font-medium text-loss-strong hover:bg-ink/[.03]"
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
