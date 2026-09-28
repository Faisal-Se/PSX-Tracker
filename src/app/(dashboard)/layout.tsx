"use client";

import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { useStore } from "@/store/useStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const balancesHidden = useStore((s) => s.balancesHidden);
  return (
    <div
      className="flex min-h-dvh flex-col bg-canvas text-ink"
      data-hide-balances={balancesHidden ? "true" : "false"}
    >
      <TopNav />
      <AnnouncementBanner />
      <main className="mx-auto w-full max-w-[1340px] flex-1 px-6 pb-16 pt-[22px]">
        {children}
      </main>
      <Footer />
    </div>
  );
}
