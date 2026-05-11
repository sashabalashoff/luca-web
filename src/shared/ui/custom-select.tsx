"use client";

import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled,
  className = "",
  searchable,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setQuery(""); return; }
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.value.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  return (
    <div ref={containerRef} className={["relative", className].join(" ")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition",
          open ? "border-[rgb(var(--accent))] ring-2 ring-[rgb(var(--accent)/0.12)]" : "hover:border-[rgb(var(--border))]",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        ].join(" ")}
      >
        <span className={selected ? "text-[rgb(var(--foreground))]" : "text-[rgb(var(--muted))]"}>
          {selected ? (selected.icon ? <span className="flex items-center gap-1.5">{selected.icon}{selected.label}</span> : selected.label) : placeholder}
        </span>
        <CaretDownIcon
          size={13}
          className={["text-[rgb(var(--muted))] transition-transform duration-150", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--background))] shadow-xl">
          {searchable && (
            <div className="border-b border-[rgb(var(--border-soft))] px-3 py-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[rgb(var(--muted-soft))]"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[rgb(var(--muted))]">No results</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={[
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition hover:bg-[rgb(var(--surface-soft))]",
                    opt.value === value ? "text-[rgb(var(--accent))]" : "text-[rgb(var(--foreground))]",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    {opt.icon && <span className="text-[rgb(var(--muted))]">{opt.icon}</span>}
                    <span>{opt.label}</span>
                    {opt.description && (
                      <span className="text-xs text-[rgb(var(--muted))]">{opt.description}</span>
                    )}
                  </span>
                  {opt.value === value && <CheckIcon size={12} weight="bold" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
