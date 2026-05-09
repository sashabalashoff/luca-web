"use client";

import { AppIcons } from "@/shared/icons/app-icons";
import { useTheme } from "next-themes";

export function ThemeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? AppIcons.sun : AppIcons.moon;

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--muted))] transition hover:text-[rgb(var(--foreground))]"
    >
      <Icon size={18} weight="duotone" />
    </button>
  );
}