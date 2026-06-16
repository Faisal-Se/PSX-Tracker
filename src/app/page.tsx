"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandSplash } from "@/components/BrandSplash";

// Logged-in users go straight to the app; visitors see the landing page.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (cancelled) return;
        router.replace(res.ok ? "/dashboard" : "/home");
      } catch {
        if (!cancelled) router.replace("/home");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <BrandSplash label="Getting things ready" />;
}
