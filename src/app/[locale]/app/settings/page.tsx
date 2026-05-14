"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { useLuca } from "@/shared/providers/luca-provider";
import { Locale, locales } from "@/shared/config/locales";
import { useTheme } from "next-themes";
import {
  BuildingsIcon,
  CheckIcon,
  CreditCardIcon,
  MoonIcon,
  PaintBrushIcon,
  PlusIcon,
  SignOutIcon,
  SunIcon,
  TrashIcon,
  UserIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SectionId = "profile" | "appearance" | "workspace" | "team" | "plan" | "session";

const NAV: { id: SectionId; en: string; ru: string; Icon: React.ElementType }[] = [
  { id: "profile", en: "Profile", ru: "Профиль", Icon: UserIcon },
  { id: "appearance", en: "Appearance", ru: "Внешний вид", Icon: PaintBrushIcon },
  { id: "workspace", en: "Workspace", ru: "Воркспейс", Icon: BuildingsIcon },
  { id: "team", en: "Team", ru: "Команда", Icon: UsersThreeIcon },
  { id: "plan", en: "Plan & Version", ru: "Тариф и версия", Icon: CreditCardIcon },
  { id: "session", en: "Session", ru: "Сессия", Icon: SignOutIcon },
];

export default function SettingsPage() {
  const { locale } = useI18n();
  const { workspace, workspaces, reload, appConfig, billing, isFeatureEnabled } = useLuca();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createSupabaseBrowserClient();
  const { resolvedTheme, setTheme } = useTheme();

  const [activeSection, setActiveSection] = useState<SectionId>("profile");

  /* ── Profile ──────────────────────────────────── */
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [profileInput, setProfileInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    apiFetch<{ user: { email: string; name: string | null } }>("/api/settings")
      .then((data) => {
        setUserEmail(data.user.email);
        setUserName(data.user.name);
        setProfileInput(data.user.name ?? "");
      })
      .catch(console.error);
  }, []);

  async function saveProfile() {
    if (!profileInput.trim()) return;
    setSavingProfile(true);
    try {
      await apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ name: profileInput.trim() }),
      });
      setUserName(profileInput.trim());
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  }

  /* ── Workspace ────────────────────────────────── */
  const [wsName, setWsName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [currencyInput, setCurrencyInput] = useState("");
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);

  useEffect(() => {
    if (workspace) {
      setWsName(workspace.name ?? "");
      setCurrencyInput(workspace.baseCurrency ?? "");
    }
  }, [workspace]);

  async function saveName() {
    if (!workspace || !wsName.trim()) return;
    setSavingName(true);
    try {
      await apiFetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: wsName.trim() }),
      });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
      await reload();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingName(false);
    }
  }

  async function saveCurrency() {
    const val = currencyInput.trim().toUpperCase();
    if (!workspace || !val || val.length !== 3) return;
    setSavingCurrency(true);
    try {
      await apiFetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ baseCurrency: val }),
      });
      setCurrencySaved(true);
      setTimeout(() => setCurrencySaved(false), 2000);
      await reload();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCurrency(false);
    }
  }

  /* ── Team ─────────────────────────────────────── */
  type WorkspaceMember = {
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
    user: { id: string; email: string | null; name: string | null };
  };
  type WorkspaceInvitation = {
    id: string;
    email: string;
    role: "ADMIN" | "MEMBER" | "VIEWER";
    status: string;
    token: string;
    expiresAt: string;
  };

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "MEMBER" as "ADMIN" | "MEMBER" | "VIEWER" });
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);

  async function loadTeam() {
    if (!workspace || !isFeatureEnabled("workspaceMembers")) return;
    setTeamLoading(true);
    try {
      const [membersResult, invitationsResult] = await Promise.all([
        apiFetch<{ members: WorkspaceMember[] }>(`/api/workspaces/${workspace.id}/members`),
        apiFetch<{ invitations: WorkspaceInvitation[] }>(`/api/workspaces/${workspace.id}/invitations`),
      ]);
      setMembers(membersResult.members);
      setInvitations(invitationsResult.invitations);
    } catch (err) {
      console.error(err);
    } finally {
      setTeamLoading(false);
    }
  }

  useEffect(() => {
    loadTeam();
  }, [workspace, appConfig.flags.workspaceMembers]);

  async function inviteMember() {
    if (!workspace || !inviteForm.email.trim()) return;
    setTeamSaving(true);
    try {
      await apiFetch(`/api/workspaces/${workspace.id}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email: inviteForm.email.trim(), role: inviteForm.role }),
      });
      setInviteForm({ email: "", role: "MEMBER" });
      await loadTeam();
    } catch (err) {
      console.error(err);
    } finally {
      setTeamSaving(false);
    }
  }

  async function updateMemberRole(memberId: string, role: "ADMIN" | "MEMBER" | "VIEWER") {
    if (!workspace) return;
    try {
      await apiFetch(`/api/workspaces/${workspace.id}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
    } catch (err) {
      console.error(err);
    }
  }

  async function removeMember(memberId: string) {
    if (!workspace) return;
    try {
      await apiFetch(`/api/workspaces/${workspace.id}/members/${memberId}`, { method: "DELETE" });
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      console.error(err);
    }
  }

  async function revokeInvitation(invitationId: string) {
    if (!workspace) return;
    try {
      await apiFetch(`/api/workspaces/${workspace.id}/invitations/${invitationId}`, { method: "DELETE" });
      await loadTeam();
    } catch (err) {
      console.error(err);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  }

  function switchLocale(next: Locale) {
    const segments = pathname.split("/");
    segments[1] = next;
    router.push(segments.join("/"));
  }

  /* ── Billing ──────────────────────────────────── */
  const planType = billing?.subscriptions?.[0]?.plan?.type ?? "FREE";
  const planName = billing?.subscriptions?.[0]?.plan?.name ?? planType;
  const workspaceLimit =
    Number(billing?.entitlements.workspace_limit ?? 1) +
    Number(billing?.entitlements.extra_workspace_slots ?? 0);
  const memberInvitesEnabled = billing?.entitlements.member_invites_enabled === true;
  const memberLimit = Number(billing?.entitlements.member_limit_per_workspace ?? 1);

  /* ── Nav items ────────────────────────────────── */
  const navItems = NAV.filter((item) => item.id !== "team" || isFeatureEnabled("workspaceMembers"));
  const isDark = resolvedTheme === "dark";

  return (
    <div className="luca-page space-y-0 pb-16">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">
          {locale === "ru" ? "Настройки" : "Settings"}
        </h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          {locale === "ru" ? "Профиль, внешний вид и параметры воркспейса." : "Profile, appearance, and workspace preferences."}
        </p>
      </div>

      <div className="flex gap-8">
        {/* ── Left nav (desktop) ── */}
        <aside className="hidden w-48 shrink-0 md:block">
          <nav className="sticky top-6 space-y-0.5">
            {navItems.map(({ id, en, ru, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={[
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  activeSection === id
                    ? "bg-[rgb(var(--surface-soft))] font-medium text-[rgb(var(--foreground))]"
                    : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
                ].join(" ")}
              >
                <Icon size={15} weight={activeSection === id ? "bold" : "regular"} />
                {locale === "ru" ? ru : en}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Content ── */}
        <div className="min-w-0 flex-1">
          {/* Mobile tabs */}
          <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
            {navItems.map(({ id, en, ru, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={[
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  activeSection === id
                    ? "bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                    : "bg-[rgb(var(--surface-soft))] text-[rgb(var(--muted))]",
                ].join(" ")}
              >
                <Icon size={12} weight="regular" />
                {locale === "ru" ? ru : en}
              </button>
            ))}
          </div>

          {/* ── Profile ── */}
          {activeSection === "profile" && (
            <div className="space-y-6">
              <SectionHeader
                title={locale === "ru" ? "Профиль" : "Profile"}
                description={locale === "ru" ? "Ваше имя и email." : "Your name and email address."}
              />
              <div className="luca-panel divide-y divide-[rgb(var(--border-soft))]">
                <SettingsRow
                  label={locale === "ru" ? "Email" : "Email"}
                  hint={locale === "ru" ? "Не редактируется" : "Cannot be changed"}
                >
                  <span className="text-sm text-[rgb(var(--muted))]">{userEmail ?? "…"}</span>
                </SettingsRow>
                <SettingsRow
                  label={locale === "ru" ? "Отображаемое имя" : "Display name"}
                  hint={locale === "ru" ? "Видно участникам воркспейса" : "Visible to workspace members"}
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={profileInput}
                      onChange={(e) => setProfileInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveProfile(); }}
                      placeholder={locale === "ru" ? "Ваше имя" : "Your name"}
                      className="h-8 min-w-0 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))] sm:w-48"
                    />
                    <button
                      onClick={saveProfile}
                      disabled={savingProfile || !profileInput.trim() || profileInput.trim() === userName}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-[rgb(var(--foreground))] px-3 text-xs font-medium text-[rgb(var(--background))] disabled:opacity-40"
                    >
                      {profileSaved ? (
                        <><CheckIcon size={11} weight="bold" />{locale === "ru" ? "Сохранено" : "Saved"}</>
                      ) : (
                        locale === "ru" ? "Сохранить" : "Save"
                      )}
                    </button>
                  </div>
                </SettingsRow>
              </div>
            </div>
          )}

          {/* ── Appearance ── */}
          {activeSection === "appearance" && (
            <div className="space-y-6">
              <SectionHeader
                title={locale === "ru" ? "Внешний вид" : "Appearance"}
                description={locale === "ru" ? "Тема и язык интерфейса." : "Interface theme and language."}
              />
              <div className="luca-panel divide-y divide-[rgb(var(--border-soft))]">
                <SettingsRow
                  label={locale === "ru" ? "Тема" : "Theme"}
                  hint={locale === "ru" ? "Светлая или тёмная тема" : "Light or dark mode"}
                >
                  <div className="flex overflow-hidden rounded-lg border border-[rgb(var(--border))]">
                    <button
                      onClick={() => setTheme("light")}
                      className={[
                        "flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors",
                        !isDark
                          ? "bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                          : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]",
                      ].join(" ")}
                    >
                      <SunIcon size={14} weight="regular" />
                      {locale === "ru" ? "Светлая" : "Light"}
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={[
                        "flex items-center gap-1.5 border-l border-[rgb(var(--border))] px-3 py-1.5 text-sm transition-colors",
                        isDark
                          ? "bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                          : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]",
                      ].join(" ")}
                    >
                      <MoonIcon size={14} weight="regular" />
                      {locale === "ru" ? "Тёмная" : "Dark"}
                    </button>
                  </div>
                </SettingsRow>
                <SettingsRow
                  label={locale === "ru" ? "Язык" : "Language"}
                  hint={locale === "ru" ? "Язык интерфейса" : "Interface language"}
                >
                  <div className="flex overflow-hidden rounded-lg border border-[rgb(var(--border))]">
                    {locales.map((loc, i) => (
                      <button
                        key={loc}
                        onClick={() => switchLocale(loc)}
                        className={[
                          "px-3 py-1.5 text-sm font-medium uppercase tracking-wide transition-colors",
                          loc === locale
                            ? "bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                            : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]",
                          i > 0 ? "border-l border-[rgb(var(--border))]" : "",
                        ].join(" ")}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </SettingsRow>
              </div>
            </div>
          )}

          {/* ── Workspace ── */}
          {activeSection === "workspace" && (
            <div className="space-y-6">
              <SectionHeader
                title={locale === "ru" ? "Воркспейс" : "Workspace"}
                description={
                  locale === "ru"
                    ? "Основные параметры текущего воркспейса."
                    : "Basic settings for the current workspace."
                }
              />
              <div className="luca-panel divide-y divide-[rgb(var(--border-soft))]">
                <SettingsRow
                  label={locale === "ru" ? "Название" : "Name"}
                  hint={locale === "ru" ? "Отображается в сайдбаре" : "Shown in the sidebar"}
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={wsName}
                      onChange={(e) => setWsName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                      className="h-8 min-w-0 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))] sm:w-48"
                    />
                    <button
                      onClick={saveName}
                      disabled={savingName || !wsName.trim() || wsName.trim() === workspace?.name}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-[rgb(var(--foreground))] px-3 text-xs font-medium text-[rgb(var(--background))] disabled:opacity-40"
                    >
                      {nameSaved ? (
                        <><CheckIcon size={11} weight="bold" />{locale === "ru" ? "Сохранено" : "Saved"}</>
                      ) : (
                        locale === "ru" ? "Сохранить" : "Save"
                      )}
                    </button>
                  </div>
                </SettingsRow>
                <SettingsRow
                  label={locale === "ru" ? "Базовая валюта" : "Base currency"}
                  hint={locale === "ru" ? "3-буквенный код (USD, EUR, RUB…)" : "3-letter code (USD, EUR, RUB…)"}
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={currencyInput}
                      onChange={(e) => setCurrencyInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter") saveCurrency(); }}
                      maxLength={3}
                      placeholder="USD"
                      className="h-8 w-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-center font-mono text-sm uppercase outline-none focus:border-[rgb(var(--accent))]"
                    />
                    <button
                      onClick={saveCurrency}
                      disabled={savingCurrency || currencyInput.trim().length !== 3 || currencyInput.trim() === workspace?.baseCurrency}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-[rgb(var(--foreground))] px-3 text-xs font-medium text-[rgb(var(--background))] disabled:opacity-40"
                    >
                      {currencySaved ? (
                        <><CheckIcon size={11} weight="bold" />{locale === "ru" ? "Сохранено" : "Saved"}</>
                      ) : (
                        locale === "ru" ? "Сохранить" : "Save"
                      )}
                    </button>
                  </div>
                </SettingsRow>
              </div>
            </div>
          )}

          {/* ── Team ── */}
          {activeSection === "team" && isFeatureEnabled("workspaceMembers") && (
            <div className="space-y-6">
              <SectionHeader
                title={locale === "ru" ? "Команда" : "Team"}
                description={
                  locale === "ru"
                    ? "Участники и приглашения в текущий воркспейс."
                    : "Members and invitations for the current workspace."
                }
              />

              {/* Stats row */}
              <div className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] px-4 py-3">
                <div className="flex-1 text-sm">
                  <span className="font-semibold">{members.length}</span>
                  <span className="text-[rgb(var(--muted))]">/{memberLimit} {locale === "ru" ? "участников" : "members"}</span>
                </div>
                <span className={[
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  memberInvitesEnabled
                    ? "bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]"
                    : "bg-[rgb(var(--surface))] text-[rgb(var(--muted))]",
                ].join(" ")}>
                  {planName}
                </span>
                {teamLoading && <span className="text-xs text-[rgb(var(--muted))]">…</span>}
              </div>

              {/* Invite form */}
              {memberInvitesEnabled && (
                <div className="luca-panel p-4">
                  <div className="mb-3 text-sm font-medium">
                    {locale === "ru" ? "Пригласить участника" : "Invite member"}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="h-9 flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
                    />
                    <select
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as "ADMIN" | "MEMBER" | "VIEWER" }))}
                      className="h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <button
                      onClick={inviteMember}
                      disabled={teamSaving || !inviteForm.email.trim()}
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-[rgb(var(--foreground))] px-4 text-sm font-medium text-[rgb(var(--background))] disabled:opacity-40"
                    >
                      <PlusIcon size={13} weight="bold" />
                      {locale === "ru" ? "Пригласить" : "Invite"}
                    </button>
                  </div>
                </div>
              )}

              {/* Members list */}
              {members.length > 0 && (
                <div className="luca-panel divide-y divide-[rgb(var(--border-soft))]">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-soft))] text-xs font-semibold uppercase text-[rgb(var(--muted))]">
                        {(member.user.name || member.user.email || "?")[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {member.user.name || member.user.email || member.user.id}
                        </div>
                        {member.user.name && member.user.email && (
                          <div className="truncate text-xs text-[rgb(var(--muted))]">{member.user.email}</div>
                        )}
                      </div>
                      {member.role === "OWNER" ? (
                        <span className="rounded-full bg-[rgb(var(--surface-soft))] px-2.5 py-0.5 text-xs font-semibold text-[rgb(var(--muted))]">
                          Owner
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) => updateMemberRole(member.id, e.target.value as "ADMIN" | "MEMBER" | "VIEWER")}
                            className="h-7 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-xs outline-none"
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="MEMBER">Member</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                          <button
                            onClick={() => removeMember(member.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
                          >
                            <TrashIcon size={13} weight="bold" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pending invites */}
              {invitations.filter((i) => i.status === "PENDING").length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                    {locale === "ru" ? "Ожидают принятия" : "Pending invites"}
                  </div>
                  {invitations.filter((i) => i.status === "PENDING").map((inv) => {
                    const link =
                      typeof window === "undefined"
                        ? ""
                        : `${window.location.origin}/${locale}/app/invitations/${inv.token}`;
                    return (
                      <div key={inv.id} className="luca-panel flex items-start gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{inv.email}</div>
                          <div className="text-xs text-[rgb(var(--muted))]">{inv.role}</div>
                          {link && (
                            <button
                              onClick={() => navigator.clipboard?.writeText(link)}
                              className="mt-1 truncate text-xs text-[rgb(var(--accent))] hover:underline"
                            >
                              {locale === "ru" ? "Скопировать ссылку" : "Copy link"}
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => revokeInvitation(inv.id)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]"
                        >
                          <XIcon size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Plan & Version ── */}
          {activeSection === "plan" && (
            <div className="space-y-6">
              <SectionHeader
                title={locale === "ru" ? "Тариф и версия" : "Plan & Version"}
                description={
                  locale === "ru"
                    ? "Ваш текущий тариф, лимиты и версия приложения."
                    : "Your current plan, limits, and app version."
                }
              />
              <div className="luca-panel divide-y divide-[rgb(var(--border-soft))]">
                <SettingsRow label={locale === "ru" ? "Тариф" : "Plan"}>
                  <div className="flex items-center gap-2">
                    <span className={[
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      planType === "FREE"
                        ? "bg-[rgb(var(--surface-soft))] text-[rgb(var(--muted))]"
                        : "bg-[rgb(var(--accent-dim,var(--surface-soft)))] text-[rgb(var(--accent))]",
                    ].join(" ")}>
                      {planName}
                    </span>
                  </div>
                </SettingsRow>
                <SettingsRow
                  label={locale === "ru" ? "Воркспейсы" : "Workspaces"}
                  hint={locale === "ru" ? "Использовано / лимит" : "Used / limit"}
                >
                  <span className="text-sm tabular-nums text-[rgb(var(--muted))]">
                    {workspaces.length} / {workspaceLimit || "∞"}
                  </span>
                </SettingsRow>
                <SettingsRow
                  label={locale === "ru" ? "Участников на воркспейс" : "Members per workspace"}
                >
                  <span className="text-sm tabular-nums text-[rgb(var(--muted))]">
                    {memberInvitesEnabled ? memberLimit || "∞" : locale === "ru" ? "недоступно" : "not available"}
                  </span>
                </SettingsRow>
                <SettingsRow label={locale === "ru" ? "Версия" : "Version"}>
                  <span className="font-mono text-sm text-[rgb(var(--muted))]">{appConfig.version}</span>
                </SettingsRow>
                <div className="px-4 py-3">
                  <div className="mb-2 text-sm font-medium text-[rgb(var(--foreground))]">
                    Feature flags
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(appConfig.flags).map(([key, enabled]) => (
                      <span
                        key={key}
                        className={[
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                          enabled
                            ? "bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]"
                            : "bg-[rgb(var(--surface-soft))] text-[rgb(var(--muted))]",
                        ].join(" ")}
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Session ── */}
          {activeSection === "session" && (
            <div className="space-y-6">
              <SectionHeader
                title={locale === "ru" ? "Сессия" : "Session"}
                description={
                  locale === "ru"
                    ? "Управление текущей сессией."
                    : "Manage your current session."
                }
              />
              <div className="luca-panel divide-y divide-[rgb(var(--border-soft))]">
                <SettingsRow
                  label={locale === "ru" ? "Аккаунт" : "Account"}
                  hint={userEmail ?? ""}
                >
                  <button
                    onClick={signOut}
                    className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--negative))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--negative))] transition hover:bg-[rgb(var(--negative-dim))]"
                  >
                    <SignOutIcon size={14} weight="bold" />
                    {locale === "ru" ? "Выйти" : "Sign out"}
                  </button>
                </SettingsRow>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-[rgb(var(--foreground))]">{title}</h2>
      {description && (
        <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{description}</p>
      )}
    </div>
  );
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[rgb(var(--foreground))]">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-[rgb(var(--muted))]">{hint}</div>}
      </div>
      {children && <div className="shrink-0 sm:text-right">{children}</div>}
    </div>
  );
}
