"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TrendingUp, Shield, HardDrive } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZyIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMC41IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2cpIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIvPjwvc3ZnPg==')] opacity-50" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-emerald-500/10 to-transparent" />
        <div className="relative flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <TrendingUp
                className="h-5 w-5 text-white"
                strokeWidth={2.5}
              />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              PSX Tracker
            </span>
          </div>
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Track your Pakistan
              <br />
              Stock Exchange
              <br />
              <span className="text-emerald-400">portfolio.</span>
            </h2>
            <p className="text-white/50 mt-4 text-sm leading-relaxed max-w-sm">
              Real-time KSE-100 data, virtual trading, portfolio analytics, and
              watchlists. Everything you need to master the PSX market.
            </p>

            {/* Privacy badges */}
            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <HardDrive className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white/80 text-xs font-semibold">
                    Your Data, Your Google Drive
                  </p>
                  <p className="text-white/35 text-[10px]">
                    All portfolio data is stored in your own Google Drive
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white/80 text-xs font-semibold">
                    Zero Access by Admin
                  </p>
                  <p className="text-white/35 text-[10px]">
                    We cannot read, share, or access your portfolio data
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="text-xs text-white/20">
            <p>
              Built by{" "}
              <a
                href="https://www.instagram.com/faisiheree/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-pink-400 transition-colors"
              >
                Faisal Qayyum
              </a>
            </p>
            <p className="mt-1">&copy; 2026 PSX Tracker. For educational purposes only.</p>
          </div>
        </div>
      </div>

      {/* Right - Google Sign In */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 sm:p-8 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile logo + branding */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 items-center justify-center shadow-lg shadow-emerald-500/25 mb-4">
              <TrendingUp
                className="h-7 w-7 text-white"
                strokeWidth={2.5}
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight">PSX Tracker</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Pakistan Stock Exchange Portfolio Tracker
            </p>
          </div>

          <h1 className="text-2xl font-bold tracking-tight lg:block hidden">Welcome</h1>
          <h1 className="text-xl font-bold tracking-tight lg:hidden text-center">Sign in to continue</h1>
          <p className="text-sm text-muted-foreground mt-1.5 mb-8 lg:text-left text-center">
            Your data stays in your own Google Drive — we never store it.
          </p>

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg mb-4">
              {error === "no_code"
                ? "Authentication was cancelled"
                : error === "auth_failed"
                  ? "Authentication failed. Please try again."
                  : "Something went wrong"}
            </div>
          )}

          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 font-semibold text-base rounded-xl gap-3"
            variant="outline"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {loading ? "Redirecting..." : "Continue with Google"}
          </Button>

          {/* Privacy info cards - mobile */}
          <div className="lg:hidden mt-8 space-y-2.5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
              <HardDrive className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Data stored in <span className="font-semibold text-foreground">your Google Drive</span>
              </p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
              <Shield className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Zero access</span> by admin or anyone else
              </p>
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground mt-6 leading-relaxed">
            By continuing, you agree to let PSX Tracker store portfolio data in
            a private app folder in your Google Drive.
          </p>

          {/* Mobile footer */}
          <div className="lg:hidden text-center mt-8 text-[11px] text-muted-foreground/50">
            <p>
              Built by{" "}
              <a
                href="https://www.instagram.com/faisiheree/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-400/70 hover:text-pink-400 transition-colors"
              >
                Faisal Qayyum
              </a>
            </p>
            <p className="mt-0.5">&copy; 2026 PSX Tracker</p>
          </div>
        </div>
      </div>
    </div>
  );
}
