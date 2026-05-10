"use client";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { AppIcons } from "@/shared/icons/app-icons";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { LucaProvider, useLuca } from "@/shared/providers/luca-provider";
import { ListIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
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

function SidebarNav({ locale, onNavigate }: { locale: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-1 no-scrollbar">
      <div className="space-y-px">
        {nav.map((item) => {
          const Icon = item.icon;
          const href = `/${locale}${item.href}`;
          const isActive = item.href === "/app" ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              key={item.href}
              href={href}
              onClick={onNavigate}
              className={[
                "flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-sm transition-colors duration-100",
                isActive
                  ? "bg-[rgb(var(--surface-soft))] font-medium text-[rgb(var(--foreground))]"
                  : "font-normal text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
              ].join(" ")}
            >
              <Icon size={16} weight="regular" className="shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
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
    <div className="shrink-0 border-t border-[rgb(var(--border-soft))] px-2 py-3">
      <Link
        href={`/${locale}/app/settings`}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-[rgb(var(--surface-soft))]"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[11px] font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-snug text-[rgb(var(--foreground))]">
            {workspace?.name ?? "…"}
          </div>
          <div className="truncate text-xs leading-snug text-[rgb(var(--muted))]">
            {email ?? "…"}
          </div>
        </div>
      </Link>
    </div>
  );
}

function Sidebar({ locale }: { locale: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] flex-col border-r border-[rgb(var(--border-soft))] bg-[rgb(var(--background))] lg:flex">
      <div className="flex h-14 shrink-0 items-center px-5">
        <Link
          href={`/${locale}/app`}
          className="text-[15px] font-semibold tracking-tight text-[rgb(var(--foreground))]"
        >
          LUCA
        </Link>
      </div>
      <SidebarNav locale={locale} />
      <SidebarFooter locale={locale} />
    </aside>
  );
}

function MobileSidebar({
  locale,
  open,
  onClose
}: {
  locale: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className={[
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        ].join(" ")}
        onClick={onClose}
      />
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] flex-col border-r border-[rgb(var(--border-soft))] bg-[rgb(var(--background))] shadow-2xl transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        ].join(" ")}
      >
        <div className="flex h-[var(--header-height)] shrink-0 items-center justify-between px-5">
          <Link
            href={`/${locale}/app`}
            onClick={onClose}
            className="text-[15px] font-semibold tracking-tight text-[rgb(var(--foreground))]"
          >
            LUCA
          </Link>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
          >
            <XIcon size={15} />
          </button>
        </div>
        <SidebarNav locale={locale} onNavigate={onClose} />
        <SidebarFooter locale={locale} />
      </aside>
    </>
  );
}

function Header({ locale, onMenuOpen }: { locale: string; onMenuOpen: () => void }) {
  const pageTitle = usePageTitle(locale);

  return (
    <header className="sticky top-0 z-20 flex h-[var(--header-height)] shrink-0 items-center border-b border-[rgb(var(--border-soft))] bg-[rgb(var(--background))]/95 px-4 backdrop-blur-sm lg:hidden">
      <button
        onClick={onMenuOpen}
        className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
        aria-label="Open menu"
      >
        <ListIcon size={17} />
      </button>
      <span className="text-[15px] font-semibold tracking-tight">{pageTitle}</span>
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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <LucaProvider>
      <div className="luca-app">
        <Sidebar locale={locale} />
        <MobileSidebar
          locale={locale}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <div className="flex flex-1 flex-col lg:pl-[var(--sidebar-width)]">
          <Header locale={locale} onMenuOpen={() => setMobileOpen(true)} />
          <main className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </LucaProvider>
  );
}
