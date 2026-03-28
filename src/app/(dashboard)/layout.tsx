import { Sidebar } from "@/components/Sidebar";
import { MarketStatusBar } from "@/components/MarketStatusBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-[260px] flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 border-b border-border/60 bg-background/80 backdrop-blur-xl flex items-center px-8">
          <MarketStatusBar />
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
