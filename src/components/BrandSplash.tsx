/**
 * Full-screen branded loading splash — replaces the bare spinner during
 * auth/initial load. The PSX mark breathes, with a thin progress sweep below.
 */
export function BrandSplash({ label = "Loading your portfolio" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-canvas">
      <div className="relative">
        {/* soft halo */}
        <span className="absolute inset-0 -z-10 animate-ping rounded-[16px] bg-brand/20" />
        <span
          className="grid h-14 w-14 place-items-center rounded-[16px] bg-gradient-to-br from-[#4f8bf7] to-[#1d4ed8] shadow-[0_10px_30px_rgba(37,99,235,.35)]"
          style={{ animation: "splash-breathe 1.6s ease-in-out infinite" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 16 L9 10 L13 13 L20 5"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 5 V10 M20 5 H15"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <div className="text-center">
        <div className="text-[17px] font-bold tracking-[-.02em]">
          PSX<span className="font-medium text-ink-3"> Tracker</span>
        </div>
        <div className="mt-1 text-[12.5px] text-ink-3">{label}</div>
      </div>

      {/* indeterminate progress sweep */}
      <div className="relative h-[3px] w-40 overflow-hidden rounded-full bg-line">
        <span
          className="absolute inset-y-0 w-1/2 rounded-full bg-brand"
          style={{ animation: "splash-slide 1.2s ease-in-out infinite" }}
        />
      </div>

      <style>{`
        @keyframes splash-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes splash-slide {
          0% { left: -50%; }
          100% { left: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="splash-breathe"], [style*="splash-slide"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
