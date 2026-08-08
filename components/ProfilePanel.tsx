"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, UserCircle } from "lucide-react";
import type { MasterProfile } from "@/types";

const FIELDS: { key: keyof MasterProfile; label: string; placeholder: string }[] = [
  { key: "fullName", label: "Full name", placeholder: "John Doe" },
  { key: "email", label: "Email", placeholder: "john@email.com" },
  { key: "phone", label: "Phone", placeholder: "+91 …" },
  { key: "location", label: "Location", placeholder: "Navi Mumbai" },
  { key: "yearsExperience", label: "Years experience", placeholder: "5" },
  { key: "noticePeriod", label: "Notice period", placeholder: "30 days" },
  { key: "currentCtc", label: "Current CTC", placeholder: "₹18 LPA" },
  { key: "expectedCtc", label: "Expected CTC", placeholder: "₹25 LPA" },
  { key: "workAuth", label: "Work authorization", placeholder: "Indian citizen" },
  { key: "linkedinUrl", label: "LinkedIn URL", placeholder: "linkedin.com/in/…" },
  { key: "portfolioUrl", label: "Portfolio / GitHub", placeholder: "github.com/…" },
];

/**
 * Master profile editor — the single source of truth used to auto-draft answer
 * packs. Persisted by the parent (localStorage), never sent anywhere except the
 * answer-pack request the user triggers.
 */
export function ProfilePanel({
  profile,
  onChange,
}: {
  profile: MasterProfile;
  onChange: (p: MasterProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const filled = FIELDS.filter((f) => profile[f.key]?.trim()).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white">
            <UserCircle size={13} />
          </span>
          Master profile
          <span className="text-xs font-medium text-slate-400">
            {filled}/{FIELDS.length} filled
          </span>
        </span>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {open && (
        <>
          <p className="mt-2 text-xs text-slate-500">
            Saved in your browser. Used to auto-fill answer packs — no passwords, ever.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="text-xs font-medium text-slate-500">
                {f.label}
                <input
                  value={profile[f.key]}
                  onChange={(e) => onChange({ ...profile, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
