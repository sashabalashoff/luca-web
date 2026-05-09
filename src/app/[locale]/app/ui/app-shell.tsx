"use client";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { AppIcons } from "@/shared/icons/app-icons";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/app", labelKey: "navigation.chat", icon: AppIcons.chat },
  {
    href: "/app/transactions",
    labelKey: "navigation.transactions",
    icon: AppIcons.transactions
  },
  {
    href: "/app/dashboard",
    labelKey: "navigation.dashboard",
    icon: AppIcons.dashboard
  },
  { href: "/app/reports", labelKey: "navigation.reports", icon: AppIcons.reports },
  { href: "/app/goals", labelKey: "navigation.goals", icon: AppIcons.goals },
  {
    href: "/app/settings",
    labelKey: "navigation.settings",
    icon: AppIcons.settings
  }
];

export function AppShell({
  locale,
  children
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <main className="luca-bg min-h-screen">
      <aside className="fixed left-0 top-0 hidden h-screen w-[292px] border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))]/70 backdrop-blur-2xl lg:block">
        <div className="flex h-24 items-center px-6">
          <Link href={`/${locale}/app`}>
            <div className="font-mono text-2xl font-semibold tracking-[-0.05em]">
              LUCA
            </div>
            <div className="mt-1 text-xs text-[rgb(var(--muted))]">
              AI financial core
            </div>
          </Link>
        </div>

        <nav className="px-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const href = `/${locale}${item.href}`;
            const isActive =
              pathname === href ||
              (item.href !== "/app" && pathname.startsWith(href));

            return (
              <Link
                key={item.href}
                href={href}
                className={[
                  "mb-1 flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm transition",
                  isActive
                    ? "bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                    : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
                ].join(" ")}
              >
                <Icon size={20} weight={isActive ? "fill" : "duotone"} />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-0 right-0 px-5">
          <div className="rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] p-4">
            <div className="text-sm font-medium">MVP Build</div>
            <div className="mt-1 text-xs leading-5 text-[rgb(var(--muted))]">
              AI chat → transaction core → reports.
            </div>
          </div>
        </div>
      </aside>

      <section className="min-h-screen lg:pl-[292px]">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[rgb(var(--border))] bg-[rgb(var(--background))]/75 px-5 backdrop-blur-2xl lg:px-8">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.26em] text-[rgb(var(--muted))]">
              workspace
            </div>
            <div className="mt-1 text-sm font-medium">Personal</div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">{children}</div>
      </section>
    </main>
  );
}