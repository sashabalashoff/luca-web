import { isLocale } from "@/shared/config/locales";
import { getDictionary } from "@/shared/i18n/dictionaries";
import { translate } from "@/shared/i18n/translate";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import {
  ArrowRight,
  ChartPieSlice,
  Sparkle,
  Wallet
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

  return (
    <main className="luca-bg min-h-screen px-5 py-5">
      <header className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href={`/${safeLocale}`} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
            <Sparkle size={18} weight="duotone" />
          </div>
          <div>
            <div className="font-mono text-xl font-semibold tracking-[-0.05em]">
              LUCA
            </div>
            <div className="text-xs text-[rgb(var(--muted))]">
              AI financial core
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-10 py-24 lg:grid-cols-[1fr_520px]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-2 text-sm text-[rgb(var(--muted))]">
            <Sparkle size={16} weight="duotone" />
            {t("landing.badge")}
          </div>

          <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] sm:text-7xl">
            {t("landing.title")}
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-[rgb(var(--muted))]">
            {t("landing.subtitle")}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={`/${safeLocale}/app`}>
              <Button className="gap-2">
                {t("landing.cta")}
                <ArrowRight size={18} weight="bold" />
              </Button>
            </Link>

            <Button variant="secondary">{t("landing.secondaryCta")}</Button>
          </div>

          <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ["AI input", "Chat-first finance tracking"],
              ["No bank login", "Works without integrations"],
              ["Personal + business", "One core for many money flows"]
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--surface))]/70 p-4"
              >
                <div className="text-sm font-medium">{title}</div>
                <div className="mt-1 text-xs leading-5 text-[rgb(var(--muted))]">
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Card className="p-5">
          <div className="rounded-[28px] bg-[rgb(var(--surface-soft))] p-5">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-[rgb(var(--muted))]">
                  Live flow
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-[-0.05em]">
                  AI → Transaction
                </div>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-[22px] bg-[rgb(var(--surface))]">
                <Wallet size={22} weight="duotone" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="max-w-[82%] rounded-[26px] bg-[rgb(var(--surface))] p-4 text-sm">
                Spent $52 at Nobu yesterday
              </div>

              <div className="ml-auto max-w-[88%] rounded-[26px] bg-[rgb(var(--foreground))] p-4 text-sm text-[rgb(var(--background))]">
                I found 1 transaction. Confirm?
              </div>

              <div className="ml-auto rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                    Expense
                  </div>
                  <ChartPieSlice size={18} weight="duotone" />
                </div>

                <div className="mt-4 text-4xl font-semibold tracking-[-0.06em]">
                  -$52.00
                </div>

                <div className="mt-2 text-sm text-[rgb(var(--muted))]">
                  Food & Dining · Nobu
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}