"use client";

import { TopNav } from "@/components/TopNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <TopNav />
      <main className="mx-auto w-full max-w-[1340px] px-6 pb-16 pt-[22px]">
        {children}
      </main>
    </div>
  );
}
