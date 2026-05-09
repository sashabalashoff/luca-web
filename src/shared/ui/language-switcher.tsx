"use client";

import { Locale, locales } from "@/shared/config/locales";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { AppIcons } from "@/shared/icons/app-icons";
import { usePathname, useRouter } from "next/navigation";

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useI18n();

  function switchLocale(nextLocale: Locale) {
    const segments = pathname.split("/");
    segments[1] = nextLocale;
    router.push(segments.join("/"));
  }

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-1">
      <div className="flex h-8 w-8 items-center justify-center text-[rgb(var(--muted))]">
        <AppIcons.globe size={16} weight="duotone" />
      </div>

      {locales.map((item) => (
        <button
          key={item}
          onClick={() => switchLocale(item)}
          className={[
            "h-8 rounded-xl px-3 text-xs font-semibold uppercase transition",
            item === locale
              ? "bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
              : "text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]"
          ].join(" ")}
        >
          {item}
        </button>
      ))}
    </div>
  );
}