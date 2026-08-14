"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Search, X } from "lucide-react";
import { LOCATION_GROUPS } from "@/lib/locations";

/**
 * Searchable multi-select for target locations (Remote + Tier-1 cities + all
 * India states/UTs). Selected values render as removable chips; the panel closes
 * on outside click or Escape.
 */
export function LocationSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = useMemo(() => new Set(value), [value]);

  function toggle(loc: string) {
    onChange(selected.has(loc) ? value.filter((v) => v !== loc) : [...value, loc]);
  }

  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      LOCATION_GROUPS.map((g) => ({
        label: g.label,
        options: q ? g.options.filter((o) => o.toLowerCase().includes(q)) : g.options,
      })).filter((g) => g.options.length > 0),
    [q]
  );

  return (
    <div className="relative" ref={ref}>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <MapPin size={12} /> Target locations
      </label>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((loc) => (
            <span
              key={loc}
              className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
            >
              {loc}
              <button
                onClick={() => toggle(loc)}
                aria-label={`Remove ${loc}`}
                className="rounded-full p-0.5 hover:bg-brand-100"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none transition hover:border-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        <span className={value.length ? "text-slate-700" : "text-slate-400"}>
          {value.length ? `${value.length} location${value.length > 1 ? "s" : ""} selected` : "Select target locations…"}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={14} className="text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city or state…"
              className="w-full text-sm outline-none placeholder:text-slate-400"
            />
            {value.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="shrink-0 text-xs font-medium text-slate-400 hover:text-rose-600"
              >
                Clear
              </button>
            )}
          </div>

          <div className="scroll-thin max-h-64 overflow-y-auto py-1">
            {groups.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-slate-400">No matches.</p>
            )}
            {groups.map((g) => (
              <div key={g.label}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {g.label}
                </p>
                {g.options.map((loc) => {
                  const on = selected.has(loc);
                  return (
                    <button
                      key={loc}
                      onClick={() => toggle(loc)}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {loc}
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"
                        }`}
                      >
                        {on && <Check size={11} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
