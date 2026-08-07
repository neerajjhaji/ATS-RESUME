"use client";

/**
 * LogiByte Innovations brand assets — an inline SVG mark (no external requests)
 * plus reusable lockups used in the header and footer.
 */

export function LogiByteMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="LogiByte Innovations"
    >
      <defs>
        <linearGradient id="lb-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#lb-grad)" />
      {/* Stylized "byte" bracket + data-flow chevrons forming an L */}
      <path
        d="M15 14v20h11"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30 18l5 6-5 6"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

/** Header product lockup. */
export function BrandHeader() {
  return (
    <div className="flex items-center gap-3.5">
      <LogiByteMark size={44} />
      <div>
        <h1 className="text-[22px] font-extrabold leading-none tracking-tight text-slate-900">
          Resume Tailor
        </h1>
        <p className="mt-1 text-[13px] font-medium text-slate-500">
          Dual-engine ATS optimization
        </p>
      </div>
    </div>
  );
}

/** The "Powered by LogiByte Innovations" tag used in the header pill + footer. */
export function PoweredBy({ variant = "pill" }: { variant?: "pill" | "plain" }) {
  if (variant === "plain") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
        <LogiByteMark size={18} />
        Powered by{" "}
        <span className="font-semibold text-slate-700">LogiByte Innovations</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
      <LogiByteMark size={16} />
      Powered by{" "}
      <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text font-semibold text-transparent">
        LogiByte Innovations
      </span>
    </span>
  );
}

export function BrandFooter() {
  const year = 2026;
  return (
    <footer className="mt-10 border-t border-slate-200 py-6">
      <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:text-left lg:px-8">
        <PoweredBy variant="plain" />
        <p className="text-xs text-slate-400">© {year} LogiByte Innovations</p>
      </div>
    </footer>
  );
}
