"use client";

import { XIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg";
}

export function Modal({ open, onClose, title, children, footer, maxWidth = "md" }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={[
          "relative z-10 flex w-full flex-col overflow-hidden",
          "rounded-t-2xl sm:rounded-2xl",
          "border border-[rgb(var(--border))] bg-[rgb(var(--background))] shadow-2xl",
          "max-h-[92dvh] sm:max-h-[88dvh]",
          widths[maxWidth],
        ].join(" ")}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-[rgb(var(--border-soft))] px-5 py-4">
            <span className="text-sm font-semibold text-[rgb(var(--foreground))]">{title}</span>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
            >
              <XIcon size={14} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-[rgb(var(--border-soft))] bg-[rgb(var(--background))] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
