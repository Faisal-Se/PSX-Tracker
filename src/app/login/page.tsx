"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, ArrowRight } from "lucide-react";
import { useStore } from "@/store/useStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      setUser(data.user);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZyIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMC41IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2cpIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIvPjwvc3ZnPg==')] opacity-50" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-emerald-500/10 to-transparent" />
        <div className="relative flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <TrendingUp className="h-5 w-5 text-white" strokeWidth={2.5} />
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
          </div>
          <p className="text-white/20 text-xs">
            &copy; 2026 PSX Tracker. For educational purposes only.
          </p>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">
              PSX Tracker
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1.5 mb-8">
            Enter your credentials to access your portfolio
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="h-11"
              />
            </div>
            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-11 font-semibold"
              disabled={loading}
            >
              {loading ? (
                "Signing in..."
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-primary font-semibold hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
