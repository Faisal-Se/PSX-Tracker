"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Registration is no longer needed — Google OAuth handles everything
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}
