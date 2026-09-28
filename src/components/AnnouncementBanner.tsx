"use client";

import { useEffect, useState } from "react";
import { Megaphone, TriangleAlert, X } from "lucide-react";

interface Announcement {
  id: string;
  message: string;
  tone: "info" | "warning";
}

const DISMISSED_KEY = "psx-announcement-dismissed";

/**
 * The owner's announcement, shown above every page until the user closes it.
 * Closing is remembered on this device; an edited announcement shows again.
 */
export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/announcement")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const a = data?.announcement as Announcement | null | undefined;
        if (cancelled || !a?.id || !a.message) return;
        let dismissed: string | null = null;
        try {
          dismissed = localStorage.getItem(DISMISSED_KEY);
        } catch {
          // Storage blocked: show it; closing lasts for this page only.
        }
        if (dismissed !== a.id) setAnnouncement(a);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement) return null;

  const warning = announcement.tone === "warning";
  const Icon = warning ? TriangleAlert : Megaphone;
  const color = warning ? "var(--color-loss-strong)" : "var(--color-brand)";

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, announcement.id);
    } catch {}
    setAnnouncement(null);
  };

  return (
    <div
      role="status"
      className="border-b border-line"
      style={{ background: `color-mix(in srgb, ${color} 10%, var(--color-card))` }}
    >
      <div className="mx-auto flex w-full max-w-[1340px] items-start gap-3 px-6 py-2.5">
        <Icon className="mt-[2px] h-4 w-4 shrink-0" style={{ color }} />
        <p className="min-w-0 flex-1 break-words text-[13px] font-medium leading-snug text-ink">
          {announcement.message}
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-ink/[.06] hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
