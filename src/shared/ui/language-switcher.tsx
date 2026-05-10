"use client";

import { Locale, locales } from "@/shared/config/locales";
import { useI18n } from "@/shared/i18n/i18n-provider";
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
    <div className="flex items-center">
      {locales.map((item, i) => (
        <button
          key={item}
          onClick={() => switchLocale(item)}
          className={[
            "px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors",
            item === locale
              ? "text-[rgb(var(--foreground))]"
              : "text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]",
            i > 0 ? "border-l border-[rgb(var(--border))]" : ""
          ].join(" ")}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
