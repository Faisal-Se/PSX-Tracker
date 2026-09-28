"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";

interface Announcement {
  id: string;
  message: string;
  tone: "info" | "warning";
  updatedAt: string;
}

const MAX_LENGTH = 300;

/** Admin-only: write, replace or remove the banner every user sees. */
export function AnnouncementEditor() {
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "warning">("info");
  const [busy, setBusy] = useState<"" | "saving" | "removing">("");
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/announcement")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const a = data?.announcement as Announcement | null | undefined;
        if (cancelled || !a) return;
        setCurrent(a);
        setMessage(a.message);
        setTone(a.tone);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const send = async (method: "PUT" | "DELETE") => {
    setBusy(method === "PUT" ? "saving" : "removing");
    setNote(null);
    try {
      const res = await fetch("/api/admin/announcement", {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PUT" ? JSON.stringify({ message, tone }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote({ text: data.error || "That did not work. Try again.", error: true });
        return;
      }
      setCurrent(data.announcement ?? null);
      if (method === "DELETE") setMessage("");
      setNote({
        text:
          method === "PUT"
            ? "Published. Users will see it within about a minute."
            : "Removed. It disappears for users within about a minute.",
        error: false,
      });
    } catch {
      setNote({ text: "That did not work. Try again.", error: true });
    } finally {
      setBusy("");
    }
  };

  const trimmed = message.trim();
  const unchanged = !!current && current.message === trimmed && current.tone === tone;

  return (
    <section className="mb-[18px] rounded-2xl border border-line bg-card p-[22px] shadow-card">
      <div className="mb-1 flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-ink-3" />
        <h2 className="text-[16px] font-bold">Announcement</h2>
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          style={
            current
              ? { color: "var(--color-gain)", background: "var(--color-gain-50)" }
              : { color: "var(--color-ink-3)", background: "var(--color-canvas)" }
          }
        >
          {current ? "LIVE" : "NONE"}
        </span>
      </div>
      <p className="mb-3 text-[12px] text-ink-3">
        A banner shown at the top of the app to every signed-in user. Each user can close it;
        editing the message shows it to everyone again.
      </p>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
        rows={2}
        placeholder="e.g. Prices may be delayed today while PSX carries out maintenance."
        className="w-full resize-y rounded-[10px] border border-line bg-canvas px-3 py-2 text-[13px] outline-none focus:border-brand"
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-[10px] bg-canvas p-0.5">
          {(
            [
              ["info", "News"],
              ["warning", "Warning"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTone(value)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                tone === value ? "bg-card text-ink shadow-card" : "text-ink-3 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="num text-[11px] text-ink-3">
          {trimmed.length} / {MAX_LENGTH}
        </span>
        <div className="flex-1" />
        {current && (
          <button
            onClick={() => send("DELETE")}
            disabled={busy !== ""}
            className="h-9 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium text-loss-strong shadow-card hover:bg-ink/[.04] disabled:opacity-50"
          >
            {busy === "removing" ? "Removing…" : "Remove"}
          </button>
        )}
        <button
          onClick={() => send("PUT")}
          disabled={busy !== "" || !trimmed || unchanged}
          className="h-9 rounded-[10px] bg-brand px-4 text-[13px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
        >
          {busy === "saving" ? "Publishing…" : current ? "Update" : "Publish"}
        </button>
      </div>

      {note && (
        <p
          className="mt-2.5 text-[12px] font-medium"
          style={{ color: note.error ? "var(--color-loss-strong)" : "var(--color-gain)" }}
        >
          {note.text}
        </p>
      )}
    </section>
  );
}
