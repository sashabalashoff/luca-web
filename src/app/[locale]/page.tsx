import { isLocale } from "@/shared/config/locales";
import { getDictionary } from "@/shared/i18n/dictionaries";
import { translate } from "@/shared/i18n/translate";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import {
  ArrowRightIcon,
  SparkleIcon
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function LandingPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = await getDictionary(safeLocale);
  const t = (key: string) => translate(dictionary, key);

  const features =
    safeLocale === "ru"
      ? [
          ["Чат-first", "Просто скажи, что потратил — LUCA запишет"],
          ["Без банков", "Работает без привязки счетов"],
          ["Личное и бизнес", "Один инструмент для разных денежных потоков"]
        ]
      : [
          ["Chat-first", "Just tell LUCA what happened — it records it"],
          ["No bank login", "Works without account integrations"],
          ["Personal + business", "One core for every money flow"]
        ];

  return (
    <div className="luca-bg min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="font-mono text-sm font-bold tracking-tight">LUCA</div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-20 lg:py-32">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-xs text-[rgb(var(--muted))]">
          <SparkleIcon size={13} weight="fill" className="text-[rgb(var(--accent))]" />
          {t("landing.badge")}
        </div>

        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          {t("landing.title")}
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-[rgb(var(--muted))] sm:text-lg">
          {t("landing.subtitle")}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/${safeLocale}/app`}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[rgb(var(--foreground))] px-5 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 active:scale-[0.98]"
          >
            {t("landing.cta")}
            <ArrowRightIcon size={14} weight="bold" />
          </Link>
          <Link
            href={`/${safeLocale}/login`}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-5 text-sm font-medium transition hover:bg-[rgb(var(--surface-soft))]"
          >
            {t("landing.secondaryCta")}
          </Link>
        </div>

        <div className="mt-16 grid gap-3 sm:grid-cols-3">
          {features.map(([title, desc]) => (
            <div
              key={title}
              className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5"
            >
              <div className="text-sm font-medium">{title}</div>
              <div className="mt-1.5 text-sm leading-relaxed text-[rgb(var(--muted))]">
                {desc}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 max-w-sm rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
          <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted))]">
            {safeLocale === "ru" ? "Пример" : "Example flow"}
          </div>
          <div className="space-y-2">
            <div className="rounded-xl bg-[rgb(var(--surface-soft))] px-3 py-2 text-sm">
              Spent $52 at Nobu yesterday
            </div>
            <div className="rounded-xl bg-[rgb(var(--foreground))] px-3 py-2 text-sm text-[rgb(var(--background))]">
              {safeLocale === "ru"
                ? "Нашёл 1 транзакцию. Подтвердить?"
                : "Found 1 transaction. Confirm?"}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--positive-dim))] bg-[rgb(var(--positive-dim))] px-3 py-2">
              <span className="text-xs text-[rgb(var(--muted))]">
                Food · Nobu
              </span>
              <span className="text-sm font-semibold text-[rgb(var(--negative))]">
                −$52.00
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
