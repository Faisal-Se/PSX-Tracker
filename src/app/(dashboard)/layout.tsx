"use client";

import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <TopNav />
      <main className="mx-auto w-full max-w-[1340px] flex-1 px-6 pb-16 pt-[22px]">
        {children}
      </main>
      <Footer />
    </div>
  );
}
