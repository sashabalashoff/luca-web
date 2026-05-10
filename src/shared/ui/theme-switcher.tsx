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
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition-colors hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
    >
      <Icon size={15} weight="regular" />
    </button>
  );
}
