"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { AppIcons } from "@/shared/icons/app-icons";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { LucaProvider, LucaWorkspace, useLuca } from "@/shared/providers/luca-provider";
import {
  ArrowLineLeftIcon,
  ArrowLineRightIcon,
  CheckIcon,
  DotsThreeVerticalIcon,
  ListIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { OnboardingCurrencyDialog } from "./onboarding-currency-dialog";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Settings removed from nav — accessible via footer three-dot menu
const nav = [
  { href: "/app",               labelKey: "navigation.chat",         icon: AppIcons.chat },
  { href: "/app/dashboard",     labelKey: "navigation.dashboard",    icon: AppIcons.dashboard },
  { href: "/app/transactions",  labelKey: "navigation.transactions", icon: AppIcons.transactions },
  { href: "/app/accounts",      labelKey: "navigation.accounts",     icon: AppIcons.accounts },
  { href: "/app/categories",    labelKey: "navigation.categories",   icon: AppIcons.categories },
  { href: "/app/budget",        labelKey: "navigation.budget",       icon: AppIcons.budget },
  { href: "/app/reports",         labelKey: "navigation.reports",        icon: AppIcons.reports },
  { href: "/app/goals",           labelKey: "navigation.goals",          icon: AppIcons.goals },
  { href: "/app/net-worth",        labelKey: "navigation.netWorth",       icon: AppIcons.netWorth },
  { href: "/app/exchange-rates",  labelKey: "navigation.exchangeRates",  icon: AppIcons.exchangeRates },
];

const SIDEBAR_COLLAPSED_KEY = "luca-sidebar-collapsed";

function usePageTitle(locale: string): string {
  const pathname = usePathname();
  const { t } = useI18n();
  const allNav = [...nav, { href: "/app/settings", labelKey: "navigation.settings", icon: AppIcons.settings }];
  const found = allNav.findLast((item) => {
    const href = `/${locale}${item.href}`;
    return item.href === "/app" ? pathname === href : pathname.startsWith(href);
  });
  return found ? t(found.labelKey) : "LUCA";
}

/* ── Nav items ─────────────────────────────────────── */
function SidebarNav({
  locale,
  collapsed,
  onNavigate,
}: {
  locale: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="shrink-0 px-2 py-1">
      <div className="space-y-px">
        {nav.map((item) => {
          const Icon = item.icon;
          const href = `/${locale}${item.href}`;
          const isActive =
            item.href === "/app" ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              key={item.href}
              href={href}
              onClick={onNavigate}
              title={collapsed ? t(item.labelKey) : undefined}
              className={[
                "flex items-center rounded-lg transition-colors duration-100",
                collapsed
                  ? "h-9 w-9 justify-center mx-auto"
                  : "gap-2.5 px-3 py-[7px]",
                isActive
                  ? "bg-[rgb(var(--surface-soft))] font-medium text-[rgb(var(--foreground))]"
                  : "font-normal text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
              ].join(" ")}
            >
              <Icon size={16} weight="regular" className="shrink-0" />
              {!collapsed && (
                <span className="text-sm">{t(item.labelKey)}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ── Chat sessions ──────────────────────────────────── */
type ChatSession = { id: string; title: string; updatedAt: string };

function ChatSessionsList({
  locale,
  onNavigate,
}: {
  locale: string;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const { workspace } = useLuca();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSessionId = searchParams.get("s");
  const isChatRoute = pathname === `/${locale}/app`;
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!workspace || !isChatRoute) return;
    setSessions([]);
    setNextCursor(null);
    apiFetch<{ sessions: ChatSession[]; nextCursor: string | null }>(
      `/api/ai/chat/sessions?workspaceId=${workspace.id}&limit=20`
    )
      .then((r) => { setSessions(r.sessions); setNextCursor(r.nextCursor); })
      .catch(console.error);
  }, [workspace, isChatRoute, activeSessionId]);

  async function loadMore() {
    if (!workspace || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await apiFetch<{ sessions: ChatSession[]; nextCursor: string | null }>(
        `/api/ai/chat/sessions?workspaceId=${workspace.id}&limit=20&cursor=${nextCursor}`
      );
      setSessions((prev) => [...prev, ...r.sessions]);
      setNextCursor(r.nextCursor);
    } catch { /* ignore */ } finally {
      setLoadingMore(false);
    }
  }

  if (!isChatRoute) return <div className="flex-1" />;

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-t border-[rgb(var(--border-soft))] px-2 py-2">
      <div className="mb-1.5 flex items-center justify-between px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted-soft))]">
          {t("chat.sessions")}
        </span>
        <Link
          href={`/${locale}/app`}
          onClick={onNavigate}
          className="flex h-5 w-5 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
          title={t("chat.newChat")}
        >
          <PlusIcon size={11} weight="bold" />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-px">
        {sessions.length === 0 ? (
          <p className="px-3 py-1 text-xs text-[rgb(var(--muted-soft))]">
            {t("chat.noSessions")}
          </p>
        ) : (
          <>
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <Link
                  key={session.id}
                  href={`/${locale}/app?s=${session.id}`}
                  onClick={onNavigate}
                  className={[
                    "block rounded-lg px-3 py-[6px] transition-colors duration-100",
                    isActive
                      ? "bg-[rgb(var(--surface-soft))] font-medium text-[rgb(var(--foreground))]"
                      : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
                  ].join(" ")}
                >
                  <div className="truncate text-xs">{session.title || t("chat.newChat")}</div>
                  <div className="mt-0.5 text-[10px] text-[rgb(var(--muted-soft))]">
                    {formatRelativeTime(session.updatedAt)}
                  </div>
                </Link>
              );
            })}
            {nextCursor && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full rounded-lg px-3 py-1.5 text-[11px] text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))] transition disabled:opacity-50"
              >
                {loadingMore ? t("common.loading") : t("chat.loadMore")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Workspace switcher popup ───────────────────────── */
function WorkspaceSwitcherPopup({
  locale,
  onSwitch,
  onClose,
}: {
  locale: string;
  onSwitch: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { workspaces, workspace } = useLuca();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createWorkspace() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch<{ workspace: LucaWorkspace }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), type: "PERSONAL", baseCurrency: "USD" }),
      });
      onSwitch(res.workspace.id);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full left-0 right-0 z-50 mb-1 mx-0 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--background))] shadow-xl">
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted-soft))]">
          {t("workspace.switcher")}
        </div>
        <div className="max-h-48 overflow-y-auto">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { onSwitch(ws.id); onClose(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-[rgb(var(--surface-soft))]"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--accent))] text-[10px] font-bold text-white">
                {ws.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-[rgb(var(--foreground))]">
                  {ws.name}
                </div>
                <div className="text-[11px] text-[rgb(var(--muted))]">
                  {t(`workspace.${ws.type.toLowerCase()}`) || ws.type.toLowerCase()}
                  {" · "}{ws.baseCurrency}
                </div>
              </div>
              {ws.id === workspace?.id && (
                <CheckIcon size={13} weight="bold" className="shrink-0 text-[rgb(var(--accent))]" />
              )}
            </button>
          ))}
        </div>
        <div className="border-t border-[rgb(var(--border-soft))]">
          {showCreate ? (
            <div className="space-y-2 p-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createWorkspace();
                  if (e.key === "Escape") setShowCreate(false);
                }}
                placeholder={t("workspace.newName")}
                className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-1.5 text-sm outline-none focus:border-[rgb(var(--accent))]"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={createWorkspace}
                  disabled={creating || !newName.trim()}
                  className="flex-1 rounded-lg bg-[rgb(var(--foreground))] py-1.5 text-xs font-medium text-[rgb(var(--background))] disabled:opacity-40"
                >
                  {creating ? "..." : t("common.save")}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-[rgb(var(--border))] px-3 py-1.5 text-xs text-[rgb(var(--muted))]"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
            >
              <PlusIcon size={13} weight="bold" />
              {t("workspace.new")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Settings menu popup ────────────────────────────── */
function SettingsMenuPopup({
  locale,
  onClose,
}: {
  locale: string;
  onClose: () => void;
}) {
  const { t, locale: currentLocale } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const isDark = resolvedTheme === "dark";

  function switchLocale(next: string) {
    const segments = pathname.split("/");
    segments[1] = next;
    router.push(segments.join("/"));
    onClose();
  }

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.push(`/${locale}/login`);
    onClose();
  }

  const menuItems = [
    {
      icon: isDark ? AppIcons.sun : AppIcons.moon,
      label: isDark ? t("common.lightMode") : t("common.darkMode"),
      onClick: () => { setTheme(isDark ? "light" : "dark"); onClose(); },
    },
    {
      icon: AppIcons.globe,
      label: currentLocale === "en" ? "Русский" : "English",
      onClick: () => switchLocale(currentLocale === "en" ? "ru" : "en"),
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full right-0 z-50 mb-1 w-52 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--background))] shadow-xl">
        <div className="py-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))]"
              >
                <Icon size={14} weight="regular" className="shrink-0 text-[rgb(var(--muted))]" />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="border-t border-[rgb(var(--border-soft))] py-1">
          <button
            onClick={() => { router.push(`/${locale}/app/settings`); onClose(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))]"
          >
            <AppIcons.gear size={14} weight="regular" className="shrink-0 text-[rgb(var(--muted))]" />
            {t("navigation.settings")}
          </button>
        </div>
        <div className="border-t border-[rgb(var(--border-soft))] py-1">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[rgb(var(--negative))] transition hover:bg-[rgb(var(--surface-soft))]"
          >
            <AppIcons.signOut size={14} weight="regular" className="shrink-0" />
            {t("common.logout")}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Sidebar footer ─────────────────────────────────── */
function SidebarFooter({
  locale,
  collapsed,
}: {
  locale: string;
  collapsed: boolean;
}) {
  const { workspace, setWorkspaceId } = useLuca();
  const [email, setEmail] = useState<string | null>(null);
  const [popup, setPopup] = useState<"none" | "workspace" | "settings">("none");
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const initial = workspace?.name?.[0]?.toUpperCase() ?? "?";

  function closePopup() {
    setPopup("none");
  }

  return (
    <div
      ref={footerRef}
      className="relative shrink-0 border-t border-[rgb(var(--border-soft))] px-2 py-3"
    >
      {popup === "workspace" && !collapsed && (
        <WorkspaceSwitcherPopup
          locale={locale}
          onSwitch={setWorkspaceId}
          onClose={closePopup}
        />
      )}
      {popup === "settings" && (
        <SettingsMenuPopup locale={locale} onClose={closePopup} />
      )}

      <div className={["flex items-center", collapsed ? "justify-center" : "gap-1"].join(" ")}>
        <button
          onClick={() => setPopup(popup === "workspace" ? "none" : "workspace")}
          title={workspace?.name}
          className={[
            "flex items-center gap-2 rounded-lg py-2 transition hover:bg-[rgb(var(--surface-soft))]",
            collapsed ? "justify-center px-2" : "min-w-0 flex-1 px-2",
          ].join(" ")}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--accent))] text-[11px] font-bold text-white">
            {initial}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm font-medium leading-snug text-[rgb(var(--foreground))]">
                {workspace?.name ?? "…"}
              </div>
              <div className="truncate text-[11px] leading-snug text-[rgb(var(--muted))]">
                {email ?? "…"}
              </div>
            </div>
          )}
        </button>

        {!collapsed && (
          <button
            onClick={() => setPopup(popup === "settings" ? "none" : "settings")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
            title="Menu"
          >
            <DotsThreeVerticalIcon size={16} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Desktop sidebar ────────────────────────────────── */
function Sidebar({
  locale,
  collapsed,
  onToggle,
}: {
  locale: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-[rgb(var(--border-soft))] bg-[rgb(var(--background))] transition-all duration-200 lg:flex",
        collapsed ? "w-16" : "w-[var(--sidebar-width)]",
      ].join(" ")}
    >
      {/* Header */}
      <div
        className={[
          "flex h-14 shrink-0 items-center border-b border-[rgb(var(--border-soft))]",
          collapsed ? "justify-center px-0" : "justify-between px-4",
        ].join(" ")}
      >
        {!collapsed && (
          <Link
            href={`/${locale}/app`}
            className="text-[15px] font-semibold tracking-tight text-[rgb(var(--foreground))]"
          >
            LUCA
          </Link>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
        >
          {collapsed ? (
            <ArrowLineRightIcon size={14} weight="bold" />
          ) : (
            <ArrowLineLeftIcon size={14} weight="bold" />
          )}
        </button>
      </div>

      <SidebarNav locale={locale} collapsed={collapsed} />

      {!collapsed ? (
        <Suspense fallback={<div className="flex-1" />}>
          <ChatSessionsList locale={locale} />
        </Suspense>
      ) : (
        <div className="flex-1" />
      )}

      <SidebarFooter locale={locale} collapsed={collapsed} />
    </aside>
  );
}

/* ── Mobile sidebar ─────────────────────────────────── */
function MobileSidebar({
  locale,
  open,
  onClose,
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
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={onClose}
      />
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] flex-col border-r border-[rgb(var(--border-soft))] bg-[rgb(var(--background))] shadow-2xl transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-[var(--header-height)] shrink-0 items-center justify-between border-b border-[rgb(var(--border-soft))] px-4">
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
        <SidebarNav locale={locale} collapsed={false} onNavigate={onClose} />
        <Suspense fallback={<div className="flex-1" />}>
          <ChatSessionsList locale={locale} onNavigate={onClose} />
        </Suspense>
        <SidebarFooter locale={locale} collapsed={false} />
      </aside>
    </>
  );
}

/* ── Mobile header ──────────────────────────────────── */
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

/* ── App shell ──────────────────────────────────────── */
export function AppShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Load persisted collapsed state after hydration
  useEffect(() => {
    const saved =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
        : null;
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    }
  }

  return (
    <LucaProvider>
      <OnboardingCurrencyDialog />
      <div className="luca-app">
        <Sidebar locale={locale} collapsed={collapsed} onToggle={toggleCollapsed} />
        <MobileSidebar
          locale={locale}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <div
          className={[
            "flex flex-1 flex-col transition-all duration-200",
            collapsed ? "lg:pl-16" : "lg:pl-[var(--sidebar-width)]",
          ].join(" ")}
        >
          <Header locale={locale} onMenuOpen={() => setMobileOpen(true)} />
          <main className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </LucaProvider>
  );
}
