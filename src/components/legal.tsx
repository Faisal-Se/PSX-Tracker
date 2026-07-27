import Link from "next/link";

/** Shared primitives for the standalone /privacy and /terms legal pages. */

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-[62px] max-w-[820px] items-center gap-2.5 px-6">
          <Link href="/home" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-[#4f8bf7] to-[#1d4ed8]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M4 16 L9 10 L13 13 L20 5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 5 V10 M20 5 H15" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[16px] font-bold tracking-[-.02em]">
              PSX<span className="font-medium text-ink-3"> Tracker</span>
            </span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[820px] px-6 py-12">
        <h1 className="text-[30px] font-bold tracking-[-.03em]">{title}</h1>
        <p className="mt-1.5 text-[13px] text-ink-3">Last updated: {updated}</p>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

export function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-8 text-[17px] font-bold tracking-[-.02em]">{children}</h2>;
}
export function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[14.5px] leading-[1.7] text-ink-2">{children}</p>;
}
export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mb-3 space-y-2 pl-5">{children}</ul>;
}
export function LI({ children }: { children: React.ReactNode }) {
  return <li className="list-disc text-[14.5px] leading-[1.6] text-ink-2 marker:text-ink-3">{children}</li>;
}
export function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}
export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-line-soft px-1.5 py-0.5 font-mono text-[12.5px] text-ink">
      {children}
    </code>
  );
}
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
      {children}
    </a>
  );
}
