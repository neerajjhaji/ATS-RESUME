"use client";

/** Circular ATS match-score gauge. Color shifts red → amber → green with score. */
export function ScoreGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  const color = clamped >= 75 ? "#16a34a" : clamped >= 50 ? "#d97706" : "#dc2626";
  const label = clamped >= 75 ? "Strong match" : clamped >= 50 ? "Needs work" : "Weak match";

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-32 w-32 shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>
            {clamped}
          </span>
          <span className="text-xs text-slate-400">/ 100</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500">ATS Match Score</p>
        <p className="text-lg font-bold" style={{ color }}>
          {label}
        </p>
      </div>
    </div>
  );
}
