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
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Activity className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground/70">{time} PKT</span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span
            className={`${
              status.status === "open" ? "animate-ping" : ""
            } absolute inline-flex h-full w-full rounded-full ${dotColor[status.status]} opacity-75`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${dotColor[status.status]}`}
          />
        </span>
        <span className="font-semibold">{status.label}</span>
        <span className="text-muted-foreground/60">
          &middot; {status.nextEvent}
        </span>
      </div>
    </div>
  );
}
