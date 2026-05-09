import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[rgb(var(--foreground))] text-[rgb(var(--background))] hover:scale-[0.99] hover:opacity-90",
  secondary:
    "border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] text-[rgb(var(--foreground))] hover:bg-[rgb(var(--surface-raised))]",
  ghost:
    "bg-transparent text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
  danger:
    "bg-[rgb(var(--negative))] text-white hover:scale-[0.99] hover:opacity-90"
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        className
      ].join(" ")}
    />
  );
}