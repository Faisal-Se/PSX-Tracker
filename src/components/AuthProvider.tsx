"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStore } from "@/store/useStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, user } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
          if (pathname !== "/login" && pathname !== "/register") {
            router.push("/login");
          }
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [setUser, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't show sidebar on auth pages
  if (pathname === "/login" || pathname === "/register") {
    return <>{children}</>;
  }

  if (!user) return null;

  return <>{children}</>;
}
