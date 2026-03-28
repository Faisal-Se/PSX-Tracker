"use client";

import { useEffect, useState } from "react";
import { getMarketStatus } from "@/lib/market-status";
import { Activity } from "lucide-react";

export function MarketStatusBar() {
  const [status, setStatus] = useState(getMarketStatus());
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      setStatus(getMarketStatus());
      const now = new Date();
      setTime(
        now.toLocaleString("en-US", {
          timeZone: "Asia/Karachi",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const dotColor = {
    open: "bg-emerald-500",
    "pre-market": "bg-amber-500",
    "post-market": "bg-orange-500",
    closed: "bg-zinc-400",
  };

  return (
    <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap overflow-hidden">
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        <span className="font-medium text-foreground/70">{time} PKT</span>
      </div>
      <div className="h-3 w-px bg-border shrink-0" />
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={`${
              status.status === "open" ? "animate-ping" : ""
            } absolute inline-flex h-full w-full rounded-full ${dotColor[status.status]} opacity-75`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${dotColor[status.status]}`}
          />
        </span>
        <span className="font-semibold shrink-0">{status.label}</span>
        <span className="text-muted-foreground/60 truncate hidden sm:inline">
          &middot; {status.nextEvent}
        </span>
      </div>
    </div>
  );
}
