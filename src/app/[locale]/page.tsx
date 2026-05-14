import { isLocale } from "@/shared/config/locales";
import { getDictionary } from "@/shared/i18n/dictionaries";
import { translate } from "@/shared/i18n/translate";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import {
  ArrowRightIcon,
  BuildingsIcon,
  ChatCircleTextIcon,
  ShieldCheckIcon
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
  const isRu = safeLocale === "ru";

  const features = isRu
    ? [
      { icon: ChatCircleTextIcon, title: "Чат-first", desc: "Просто скажи, что потратил — LUCA запишет и сохранит" },
      { icon: ShieldCheckIcon, title: "Без банков", desc: "Работает без привязки счетов и открытых API" },
      { icon: BuildingsIcon, title: "Личное и бизнес", desc: "Один инструмент для разных денежных потоков" }
    ]
    : [
      { icon: ChatCircleTextIcon, title: "Chat-first", desc: "Just tell LUCA what happened — it records and saves it" },
      { icon: ShieldCheckIcon, title: "No bank login", desc: "Works without account integrations or open APIs" },
      { icon: BuildingsIcon, title: "Personal + business", desc: "One core for every money flow you have" }
    ];

  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      {/* Header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-[15px] font-semibold tracking-tight text-[rgb(var(--foreground))]">
          LUCA
        </span>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 lg:pt-24">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] px-3.5 py-1.5 text-xs font-medium text-[rgb(var(--muted))]">
          {t("landing.badge")}
        </div>

        <h1 className="max-w-2xl text-[2.75rem] font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
          {t("landing.title")}
        </h1>

        <p className="mt-5 max-w-lg text-base leading-relaxed text-[rgb(var(--muted))] sm:text-lg">
          {t("landing.subtitle")}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/${safeLocale}/app`}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[rgb(var(--foreground))] px-6 text-sm font-semibold text-[rgb(var(--background))] transition hover:opacity-85 active:scale-[0.98]"
          >
            {t("landing.cta")}
            <ArrowRightIcon size={14} weight="bold" />
          </Link>
          <Link
            href={`/${safeLocale}/login`}
            className="inline-flex h-11 items-center rounded-xl border border-[rgb(var(--border))] px-6 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))]"
          >
            {t("landing.secondaryCta")}
          </Link>
        </div>

        {/* Feature cards */}
        <div className="mt-16 grid gap-3 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5"
            >
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--surface-soft))]">
                <Icon size={16} weight="duotone" className="text-[rgb(var(--foreground))]" />
              </div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="mt-1.5 text-sm leading-relaxed text-[rgb(var(--muted))]">
                {desc}
              </div>
            </div>
          ))}
        </div>

        {/* Example flow */}
        <div className="mt-12 max-w-sm">
          <div className="mb-3 text-xs font-medium text-[rgb(var(--muted))]">
            {isRu ? "Пример" : "Example"}
          </div>
          <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
            <div className="space-y-px">
              <div className="flex justify-end bg-[rgb(var(--surface-soft))] px-4 py-3">
                <div className="rounded-2xl rounded-br-sm bg-[rgb(var(--foreground))] px-4 py-2 text-sm text-[rgb(var(--background))]">
                  {isRu ? "Потратил $52 в Nobu вчера" : "Spent $52 at Nobu yesterday"}
                </div>
              </div>
              <div className="bg-[rgb(var(--surface-soft))] px-4 py-3 text-sm text-[rgb(var(--muted))]">
                {isRu ? "Нашел 1 транзакцию. Подтвердить?" : "Found 1 transaction. Confirm?"}
              </div>
              <div className="border-t border-[rgb(var(--border-soft))] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold text-[rgb(var(--negative))]">−$52.00</div>
                    <div className="text-xs text-[rgb(var(--muted))]">Food · Nobu</div>
                  </div>
                  <span className="rounded-full bg-[rgb(var(--negative-dim))] px-2.5 py-0.5 text-xs font-medium text-[rgb(var(--negative))]">
                    EXPENSE
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
