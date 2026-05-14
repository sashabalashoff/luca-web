"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { AppIcons } from "@/shared/icons/app-icons";
import type { LucaFeatureFlag, LucaWorkspace } from "@/shared/providers/luca-provider";
import { LucaProvider, useLuca } from "@/shared/providers/luca-provider";
import {
  ArrowLineLeftIcon,
  ArrowLineRightIcon,
  CheckIcon,
  GlobeIcon,
  ListIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { OnboardingCurrencyDialog } from "./onboarding-currency-dialog";

type NavItem = {
  href: string;
  labelKey: string;
  icon: typeof AppIcons.chat;
  feature?: LucaFeatureFlag;
  primary?: boolean;
};

type NavGroup = {
  key: string;
  items: NavItem[];
};

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

const navGroups: NavGroup[] = [
  {
    key: "primary",
    items: [
      { href: "/app", labelKey: "navigation.chat", icon: AppIcons.chat, primary: true },
      { href: "/app/dashboard", labelKey: "navigation.dashboard", icon: AppIcons.dashboard, feature: "dashboard" as LucaFeatureFlag },
    ],
  },
  {
    key: "money",
    items: [
      { href: "/app/transactions", labelKey: "navigation.transactions", icon: AppIcons.transactions },
      { href: "/app/accounts", labelKey: "navigation.accounts", icon: AppIcons.accounts },
      { href: "/app/categories", labelKey: "navigation.categories", icon: AppIcons.categories },
    ],
  },
  {
    key: "planning",
    items: [
      { href: "/app/budget", labelKey: "navigation.budget", icon: AppIcons.budget },
      { href: "/app/reports", labelKey: "navigation.reports", icon: AppIcons.reports },
      { href: "/app/goals", labelKey: "navigation.goals", icon: AppIcons.goals, feature: "goals" as LucaFeatureFlag },
      { href: "/app/net-worth", labelKey: "navigation.netWorth", icon: AppIcons.netWorth, feature: "netWorth" as LucaFeatureFlag },
      { href: "/app/exchange-rates", labelKey: "navigation.exchangeRates", icon: AppIcons.exchangeRates, feature: "exchangeRates" as LucaFeatureFlag },
    ],
  },
];

const nav = navGroups.flatMap((group) => group.items);

const SIDEBAR_COLLAPSED_KEY = "luca-sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "luca-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 168;
const MAX_SIDEBAR_WIDTH = 400;
const COLLAPSE_THRESHOLD = 140;

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
  const { t, locale: currentLocale } = useI18n();
  const { isFeatureEnabled } = useLuca();

  const groupLabel = (key: string) => {
    if (currentLocale === "ru") {
      if (key === "money") return "Деньги";
      if (key === "planning") return "Планирование";
      return "Главное";
    }
    if (key === "money") return "Money";
    if (key === "planning") return "Planning";
    return "Home";
  };

  return (
    <nav className="shrink-0 px-2 py-2">
      <div className="space-y-3">
        {navGroups.map((group) => (
          <div key={group.key}>
            {!collapsed && group.key != 'primary' && (
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted-soft))]">
                {groupLabel(group.key)}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.filter((item) => !item.feature || isFeatureEnabled(item.feature)).map((item) => {
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
                        : "gap-2.5 px-3 py-2",
                      isActive
                        ? item.primary
                          ? "bg-[rgb(var(--foreground))] font-medium text-[rgb(var(--background))]"
                          : "bg-[rgb(var(--surface-soft))] font-medium text-[rgb(var(--foreground))]"
                        : "font-normal text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
                    ].join(" ")}
                  >
                    <Icon size={16} weight="regular" className="shrink-0" />
                    {!collapsed && (
                      <span className="truncate text-sm">{t(item.labelKey)}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
  onSwitch,
  onClose,
}: {
  onSwitch: (id: string) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { workspaces, workspace, billing } = useLuca();
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

  const workspaceLimit =
    Number(billing?.entitlements.workspace_limit ?? 1) +
    Number(billing?.entitlements.extra_workspace_slots ?? 0);
  const canCreateWorkspace = workspaceLimit <= 0 || workspaces.length < workspaceLimit;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-raised))] shadow-xl">
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
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--accent))] text-[9px] font-bold text-white">
                {ws.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-[rgb(var(--foreground))]">
                  {ws.name}
                </div>
                <div className="text-[10px] text-[rgb(var(--muted))]">
                  {locale === "ru"
                    ? ws.type === "PERSONAL" ? "Личный" : ws.type === "BUSINESS" ? "Бизнес" : ws.type
                    : ws.type.toLowerCase()}{" · "}{ws.baseCurrency}
                </div>
              </div>
              {ws.id === workspace?.id && (
                <CheckIcon size={12} weight="bold" className="shrink-0 text-[rgb(var(--accent))]" />
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
                  if (e.key === "Enter" && canCreateWorkspace) createWorkspace();
                  if (e.key === "Escape") setShowCreate(false);
                }}
                placeholder={t("workspace.newName")}
                className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-1.5 text-sm outline-none focus:border-[rgb(var(--accent))]"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={createWorkspace}
                  disabled={creating || !newName.trim() || !canCreateWorkspace}
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
              onClick={() => canCreateWorkspace && setShowCreate(true)}
              disabled={!canCreateWorkspace}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))] disabled:opacity-50"
            >
              <PlusIcon size={13} weight="bold" />
              {canCreateWorkspace
                ? t("workspace.new")
                : `${workspaces.length}/${workspaceLimit} ${locale === "ru" ? "воркспейсов" : "workspaces"}`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Sidebar header (workspace switcher area) ───────── */
function SidebarHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { workspace, setWorkspaceId } = useLuca();
  const [open, setOpen] = useState(false);
  const initial = workspace?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <div
      className={[
        "relative flex h-14 shrink-0 items-center border-b border-[rgb(var(--border-soft))]",
        collapsed ? "justify-center px-0" : "gap-1 px-2",
      ].join(" ")}
    >
      {collapsed ? (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            title={workspace?.name}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--accent))] text-[11px] font-bold text-white transition hover:opacity-85"
          >
            {initial}
          </button>
          {open && (
            <WorkspaceSwitcherPopup
              onSwitch={(id) => { setWorkspaceId(id); setOpen(false); }}
              onClose={() => setOpen(false)}
            />
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-[rgb(var(--surface-soft))]"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--accent))] text-[10px] font-bold text-white">
              {initial}
            </div>
            <span className="truncate text-sm font-semibold text-[rgb(var(--foreground))]">
              {workspace?.name ?? "LUCA"}
            </span>
          </button>
          {open && (
            <WorkspaceSwitcherPopup
              onSwitch={(id) => { setWorkspaceId(id); setOpen(false); }}
              onClose={() => setOpen(false)}
            />
          )}
          <button
            onClick={onToggle}
            title="Collapse sidebar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
          >
            <ArrowLineLeftIcon size={13} weight="bold" />
          </button>
        </>
      )}
    </div>
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
  const { t, locale: currentLocale } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const isDark = resolvedTheme === "dark";
  const isSettings = pathname.startsWith(`/${locale}/app/settings`);

  function switchLocale() {
    const next = currentLocale === "en" ? "ru" : "en";
    const segments = pathname.split("/");
    segments[1] = next;
    router.push(segments.join("/"));
  }

  if (collapsed) {
    return (
      <div className="shrink-0 border-t border-[rgb(var(--border-soft))] px-2 py-3 space-y-1">
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="flex h-9 w-9 mx-auto items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
          title={isDark ? t("common.lightMode") : t("common.darkMode")}
        >
          {isDark ? <SunIcon size={15} weight="regular" /> : <MoonIcon size={15} weight="regular" />}
        </button>
        <button
          onClick={switchLocale}
          className="flex h-9 w-9 mx-auto items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
          title={currentLocale === "en" ? "Switch to Russian" : "Switch to English"}
        >
          <GlobeIcon size={15} weight="regular" />
        </button>
        <Link
          href={`/${locale}/app/settings`}
          className={[
            "flex h-9 w-9 mx-auto items-center justify-center rounded-lg transition",
            isSettings
              ? "bg-[rgb(var(--surface-soft))] text-[rgb(var(--foreground))]"
              : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
          ].join(" ")}
          title={t("navigation.settings")}
        >
          <AppIcons.settings size={15} weight="regular" />
        </Link>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-[rgb(var(--border-soft))] px-2 py-3">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
          title={isDark ? t("common.lightMode") : t("common.darkMode")}
        >
          {isDark ? <SunIcon size={15} weight="regular" /> : <MoonIcon size={15} weight="regular" />}
        </button>
        <button
          onClick={switchLocale}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
          title={currentLocale === "en" ? "Русский" : "English"}
        >
          <GlobeIcon size={15} weight="regular" />
        </button>
        <div className="flex-1" />
        <Link
          href={`/${locale}/app/settings`}
          className={[
            "flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition",
            isSettings
              ? "bg-[rgb(var(--surface-soft))] font-medium text-[rgb(var(--foreground))]"
              : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
          ].join(" ")}
        >
          <AppIcons.settings size={14} weight="regular" className="shrink-0" />
          <span>{t("navigation.settings")}</span>
        </Link>
      </div>
    </div>
  );
}

/* ── Desktop sidebar ────────────────────────────────── */
function Sidebar({
  locale,
  collapsed,
  sidebarWidth,
  onToggle,
  onDragStart,
}: {
  locale: string;
  collapsed: boolean;
  sidebarWidth: number;
  onToggle: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}) {
  return (
    <aside
      style={collapsed ? undefined : { width: sidebarWidth }}
      className={[
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-raised))] lg:flex",
        collapsed ? "w-16" : "",
      ].join(" ")}
    >
      {/* Collapsed expand button at top */}
      {collapsed && (
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-[rgb(var(--border-soft))]">
          <button
            onClick={onToggle}
            title="Expand sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
          >
            <ArrowLineRightIcon size={13} weight="bold" />
          </button>
        </div>
      )}

      {!collapsed && (
        <SidebarHeader collapsed={false} onToggle={onToggle} />
      )}

      <SidebarNav locale={locale} collapsed={collapsed} />

      {!collapsed ? (
        <Suspense fallback={<div className="flex-1" />}>
          <ChatSessionsList locale={locale} />
        </Suspense>
      ) : (
        <div className="flex-1" />
      )}

      <SidebarFooter locale={locale} collapsed={collapsed} />

      {/* Drag handle */}
      {!collapsed && (
        <div
          onMouseDown={onDragStart}
          className="absolute inset-y-0 right-0 w-1 cursor-col-resize opacity-0 hover:opacity-100 hover:bg-[rgb(var(--accent))] transition-opacity"
        />
      )}
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
  const { workspace, setWorkspaceId } = useLuca();
  const initial = workspace?.name?.[0]?.toUpperCase() ?? "?";
  const [wsOpen, setWsOpen] = useState(false);

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
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-raised))] shadow-2xl transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="relative flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b border-[rgb(var(--border-soft))] px-3">
          <button
            onClick={() => setWsOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-[rgb(var(--surface-soft))]"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--accent))] text-[10px] font-bold text-white">
              {initial}
            </div>
            <span className="truncate text-sm font-semibold text-[rgb(var(--foreground))]">
              {workspace?.name ?? "LUCA"}
            </span>
          </button>
          {wsOpen && (
            <WorkspaceSwitcherPopup
              onSwitch={(id) => { setWorkspaceId(id); setWsOpen(false); }}
              onClose={() => setWsOpen(false)}
            />
          )}
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
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
    <header className="sticky top-0 z-20 flex h-[var(--header-height)] shrink-0 items-center border-b border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-raised))]/95 px-4 backdrop-blur-sm lg:hidden">
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
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const isDragging = useRef(false);

  useEffect(() => {
    const savedCollapsed =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
        : null;
    if (savedCollapsed === "true") setCollapsed(true);

    const savedWidth =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(SIDEBAR_WIDTH_KEY)
        : null;
    if (savedWidth) {
      const w = Number(savedWidth);
      if (w >= MIN_SIDEBAR_WIDTH && w <= MAX_SIDEBAR_WIDTH) setSidebarWidth(w);
    }
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    }
  }

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    function onMouseMove(ev: MouseEvent) {
      if (!isDragging.current) return;
      const newWidth = ev.clientX;
      if (newWidth < COLLAPSE_THRESHOLD) {
        setCollapsed(true);
        isDragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
        }
        return;
      }
      const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth));
      setCollapsed(false);
      setSidebarWidth(clamped);
    }

    function onMouseUp() {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setSidebarWidth((w) => {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
        }
        return w;
      });
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const mainPaddingLeft = collapsed ? 64 : sidebarWidth;

  return (
    <LucaProvider>
      <OnboardingCurrencyDialog />
      <div className="luca-app">
        <Sidebar
          locale={locale}
          collapsed={collapsed}
          sidebarWidth={sidebarWidth}
          onToggle={toggleCollapsed}
          onDragStart={handleDragStart}
        />
        <MobileSidebar
          locale={locale}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <div
          className="flex flex-1 flex-col lg:[padding-left:var(--sw)] lg:transition-[padding-left] lg:duration-200"
          style={{ '--sw': `${mainPaddingLeft}px` } as React.CSSProperties}
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
