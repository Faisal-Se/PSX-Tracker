"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStore } from "@/store/useStore";
import { BrandSplash } from "@/components/BrandSplash";

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
          // Public routes that don't require auth
          const publicRoutes = ["/login", "/", "/home"];
          if (!publicRoutes.includes(pathname) && !pathname.startsWith("/mock")) {
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
    return <BrandSplash />;
  }

  // Public pages render without requiring auth
  const publicRoutes = ["/login", "/", "/home"];
  if (publicRoutes.includes(pathname) || pathname.startsWith("/mock")) {
    return <>{children}</>;
  }

  if (!user) return null;

  return <>{children}</>;
}
