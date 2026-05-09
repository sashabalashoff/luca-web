import { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-12 w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-4 text-sm text-[rgb(var(--foreground))] outline-none transition placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--accent))]",
        className
      ].join(" ")}
    />
  );
}