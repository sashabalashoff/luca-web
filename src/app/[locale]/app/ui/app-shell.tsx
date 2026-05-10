"use client";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { AppIcons } from "@/shared/icons/app-icons";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { LucaProvider, useLuca } from "@/shared/providers/luca-provider";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  { href: "/app",               labelKey: "navigation.chat",         icon: AppIcons.chat },
  { href: "/app/dashboard",     labelKey: "navigation.dashboard",    icon: AppIcons.dashboard },
  { href: "/app/transactions",  labelKey: "navigation.transactions", icon: AppIcons.transactions },
  { href: "/app/reports",       labelKey: "navigation.reports",      icon: AppIcons.reports },
  { href: "/app/goals",         labelKey: "navigation.goals",        icon: AppIcons.goals },
  { href: "/app/settings",      labelKey: "navigation.settings",     icon: AppIcons.settings }
];

function usePageTitle(locale: string): string {
  const pathname = usePathname();
  const { t } = useI18n();
  const found = nav.findLast((item) => {
    const href = `/${locale}${item.href}`;
    return item.href === "/app" ? pathname === href : pathname.startsWith(href);
  });
  return found ? t(found.labelKey) : "LUCA";
}

function SidebarFooter({ locale }: { locale: string }) {
  const { workspace } = useLuca();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const initial = email?.[0]?.toUpperCase() ?? workspace?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="shrink-0 border-t border-[rgb(var(--border-soft))] p-3">
      <Link
        href={`/${locale}/app/settings`}
        className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[rgb(var(--surface-soft))]"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent-dim))] text-xs font-semibold text-[rgb(var(--accent))]">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-[rgb(var(--foreground))]">
            {workspace?.name ?? "…"}
          </div>
          <div className="truncate text-xs text-[rgb(var(--muted))]">
            {email ?? "…"}
          </div>
        </div>
      </Link>
    </div>
  );
}

function Sidebar({ locale }: { locale: string }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] flex-col border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))] lg:flex">
      {/* Brand */}
      <div className="flex h-[var(--header-height)] shrink-0 items-center border-b border-[rgb(var(--border-soft))] px-4">
        <Link href={`/${locale}/app`} className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent))]">
            <AppIcons.sparkle size={14} weight="fill" className="text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-[rgb(var(--foreground))]">
            LUCA
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {nav.map((item) => {
          const Icon = item.icon;
          const href = `/${locale}${item.href}`;
          const isActive =
            item.href === "/app"
              ? pathname === href
              : pathname.startsWith(href);

          return (
            <Link
              key={item.href}
              href={href}
              className={[
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors mb-0.5",
                isActive
                  ? "bg-[rgb(var(--accent-dim))] text-[rgb(var(--accent))] font-medium"
                  : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
              ].join(" ")}
            >
              <Icon
                size={16}
                weight={isActive ? "fill" : "regular"}
              />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <SidebarFooter locale={locale} />
    </aside>
  );
}

function Header({ locale }: { locale: string }) {
  const pageTitle = usePageTitle(locale);

  return (
    <header className="sticky top-0 z-20 flex h-[var(--header-height)] shrink-0 items-center justify-between border-b border-[rgb(var(--border))] bg-[rgb(var(--background))]/90 px-4 backdrop-blur-sm lg:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile brand */}
        <Link
          href={`/${locale}/app`}
          className="flex items-center gap-2 lg:hidden"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgb(var(--accent))]">
            <AppIcons.sparkle size={12} weight="fill" className="text-white" />
          </div>
        </Link>
        {/* Page title */}
        <span className="text-sm font-semibold text-[rgb(var(--foreground))]">
          {pageTitle}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
    </header>
  );
}

export function AppShell({
  locale,
  children
}: {
  locale: string;
  children: React.ReactNode;
}) {
  return (
    <LucaProvider>
      <div className="luca-app">
        <Sidebar locale={locale} />
        <div className="flex min-h-dvh flex-1 flex-col lg:pl-[var(--sidebar-width)]">
          <Header locale={locale} />
          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </LucaProvider>
  );
}
