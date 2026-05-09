import { TextareaHTMLAttributes } from "react";

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "w-full resize-none rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-4 py-3 text-sm text-[rgb(var(--foreground))] outline-none transition placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--accent))]",
        className
      ].join(" ")}
    />
  );
}