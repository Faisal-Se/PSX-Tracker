/**
 * App-wide signature bottom bar (handoff: landing.html footer).
 * Sacramento cursive name + product label, year-stamped tagline.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-card py-[26px]">
      <div className="mx-auto flex max-w-[1340px] flex-wrap items-center justify-between gap-4 px-6">
        <div className="flex items-baseline gap-3">
          <span
            className="text-[27px] leading-none"
            style={{ fontFamily: "var(--font-signature), cursive" }}
          >
            Faisal Qayyum
          </span>
        </div>
        <div className="text-[12px] text-ink-3">
          © {year} · Designed &amp; built with care
        </div>
      </div>
    </footer>
  );
}
