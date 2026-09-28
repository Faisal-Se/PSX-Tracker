"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Search, Copy, Check, Download } from "lucide-react";
import { useSort } from "@/lib/use-sort";
import { SortHeader } from "@/components/SortHeader";
import { Skeleton } from "@/components/ui/skeleton";

interface RegisteredUser {
  id: string;
  email: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
}

type SortKey = "name" | "email" | "firstSeen" | "lastSeen";
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** "today", "yesterday", "5 days ago" — then the date. */
function formatAgo(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return "—";
  const days = Math.floor((now - t) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => Date.now());
  const sort = useSort<SortKey>("lastSeen", ["name", "email"]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/users")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setUsers(Array.isArray(data.users) ? data.users : []);
          setTotal(Number(data.total) || 0);
          setState("ready");
        } else if (res.status === 404 || res.status === 401) {
          setState("denied");
        } else {
          setMessage(data.error || "Could not load the user list.");
          setState("error");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setMessage("Could not load the user list.");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeThisWeek = useMemo(
    () => users.filter((u) => now - new Date(u.lastSeen).getTime() < 7 * DAY_MS).length,
    [users, now]
  );
  const newThisMonth = useMemo(
    () => users.filter((u) => now - new Date(u.firstSeen).getTime() < 30 * DAY_MS).length,
    [users, now]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? users.filter(
          (u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
        )
      : users;
    return sort.sortRows(filtered, (u, key) =>
      key === "name" || key === "email"
        ? u[key].toLowerCase()
        : new Date(u[key]).getTime() || 0
    );
  }, [users, query, sort]);

  const copyEmails = async () => {
    try {
      await navigator.clipboard.writeText(shown.map((u) => u.email).join(", "));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the CSV download still works.
    }
  };

  const downloadCsv = () => {
    // Names come from users' Google profiles. A leading = + - or @ would be
    // run as a formula by a spreadsheet, so such values are made plain text.
    const cell = (v: string) =>
      `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
    const rows = [
      ["Name", "Email", "First sign-in", "Last active"],
      ...shown.map((u) => [u.name, u.email, u.firstSeen, u.lastSeen]),
    ];
    const csv = rows.map((r) => r.map(cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "psx-tracker-users.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (state === "loading") {
    return (
      <>
        <Skeleton className="mb-4 h-8 w-40" />
        <div className="mb-[18px] grid gap-[18px] sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[86px] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-2xl" />
      </>
    );
  }

  if (state === "denied") {
    return (
      <div className="py-24 text-center">
        <p className="text-sm font-medium text-ink-2">Page not found</p>
      </div>
    );
  }

  const grid = "grid-cols-[1.3fr_1.8fr_1fr_1fr]";

  return (
    <>
      <div className="mb-4">
        <div className="mb-0.5 flex items-center gap-2 text-[13px] font-medium text-ink-3">
          <Users className="h-[15px] w-[15px]" /> Admin
        </div>
        <h1 className="text-[24px] font-bold tracking-[-.02em]">Users</h1>
      </div>

      {state === "error" ? (
        <p className="rounded-2xl border border-line bg-card px-[22px] py-10 text-center text-sm text-ink-2 shadow-card">
          {message}
        </p>
      ) : (
        <>
          <div className="mb-[18px] grid gap-[18px] sm:grid-cols-3">
            <Stat label="Total users" value={total} />
            <Stat label="Active in the last 7 days" value={activeThisWeek} />
            <Stat label="New in the last 30 days" value={newThisMonth} />
          </div>

          <section className="rounded-2xl border border-line bg-card pb-2 pt-[22px] shadow-card">
            <div className="flex flex-wrap items-center gap-2 px-[22px] pb-4">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email"
                  className="h-10 w-full rounded-[10px] border border-line bg-canvas pl-9 pr-3 text-[13px] outline-none focus:border-brand"
                />
              </div>
              <button
                onClick={copyEmails}
                disabled={shown.length === 0}
                className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04] disabled:opacity-50"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy emails"}
              </button>
              <button
                onClick={downloadCsv}
                disabled={shown.length === 0}
                className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-ink/[.04] disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
            </div>

            {users.length === 0 ? (
              <p className="px-[22px] py-12 text-center text-sm text-ink-3">
                No users recorded yet. People are added the next time they open the app.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div
                    className={`grid ${grid} gap-2 border-b border-line px-[22px] pb-2.5 text-[11px] font-semibold tracking-[.03em] text-ink-3`}
                  >
                    {(
                      [
                        ["name", "NAME", "left"],
                        ["email", "EMAIL", "left"],
                        ["firstSeen", "FIRST SIGN-IN", "right"],
                        ["lastSeen", "LAST ACTIVE", "right"],
                      ] as [SortKey, string, "left" | "right"][]
                    ).map(([key, label, align]) => (
                      <SortHeader
                        key={key}
                        label={label}
                        column={key}
                        align={align}
                        sortKey={sort.sortKey}
                        sortDir={sort.sortDir}
                        onToggle={sort.toggle}
                      />
                    ))}
                  </div>
                  {shown.map((u) => (
                    <div
                      key={u.id}
                      className={`grid ${grid} items-center gap-2 border-b border-line-soft px-[22px] py-[11px] hover:bg-ink/[.03]`}
                    >
                      <span className="truncate text-[13px] font-semibold">{u.name || "—"}</span>
                      <span className="truncate text-[12.5px] text-ink-2">{u.email}</span>
                      <span className="num text-right text-[12.5px] text-ink-2">
                        {formatDate(u.firstSeen)}
                      </span>
                      <span className="num text-right text-[12.5px]">
                        {formatAgo(u.lastSeen, now)}
                      </span>
                    </div>
                  ))}
                  {shown.length === 0 && (
                    <p className="px-[22px] py-10 text-center text-sm text-ink-3">
                      No one matches that search.
                    </p>
                  )}
                </div>
              </div>
            )}
            {total > users.length && (
              <p className="px-[22px] pt-3 text-[11.5px] text-ink-3">
                Showing the {users.length} most recently active of {total}.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-[22px] py-4 shadow-card">
      <div className="mb-1.5 text-[11.5px] font-medium text-ink-2">{label}</div>
      <div className="num text-[26px] font-bold leading-none">{value.toLocaleString()}</div>
    </div>
  );
}
