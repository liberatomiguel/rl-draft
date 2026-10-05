"use client";

/**
 * Road to Worlds wizard — compact searchable country select.
 *
 * A button showing the current pick (flag chip + name) that opens a small
 * type-to-filter dropdown over the wizard's local country list. Pure local
 * state, 44px touch targets, closes on pick / Escape / outside click.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/util";
import { CountryChip } from "@/components/ui/Badge";
import { WIZARD_COUNTRIES, countryByCode } from "./countries";

export function CountrySelect({
  value,
  onChange,
  label,
  className,
}: {
  /** ISO2 code of the current pick. */
  value: string;
  onChange: (code: string) => void;
  /** Accessible label + search placeholder (copy-provided). */
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = countryByCode(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WIZARD_COUNTRIES;
    return WIZARD_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().startsWith(q),
    );
  }, [query]);

  // Outside click + Escape close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-line-strong",
          "bg-white/5 px-3 text-left text-sm text-ink transition-colors hover:border-line-strong hover:bg-white/10",
          open && "!border-orange/60",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CountryChip code={value} />
          <span className="truncate">{current?.name ?? value}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={cx("h-4 w-4 shrink-0 text-sub transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="panel-strong absolute left-0 right-0 top-[calc(100%+0.375rem)] z-30 overflow-hidden p-2 shadow-xl">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                e.preventDefault();
                pick(filtered[0].code);
              }
            }}
            placeholder={label}
            aria-label={label}
            className={cx(
              "mb-1 h-10 w-full rounded-md border border-line bg-black/30 px-3 text-sm text-ink",
              "placeholder:text-faint focus:border-orange/60 focus:outline-none",
            )}
          />
          <ul role="listbox" aria-label={label} className="max-h-56 overflow-y-auto">
            {filtered.map((c) => {
              const active = c.code === value;
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(c.code)}
                    className={cx(
                      "flex h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors",
                      active ? "bg-orange/15 text-orange-bright" : "text-sub hover:bg-white/5 hover:text-ink",
                    )}
                  >
                    <CountryChip code={c.code} />
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto font-mono text-[10px] tracking-widest text-faint">{c.code}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li className="px-2.5 py-3 text-center text-xs text-faint">—</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
