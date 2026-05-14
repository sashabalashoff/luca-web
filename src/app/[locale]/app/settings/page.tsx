"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { useLuca } from "@/shared/providers/luca-provider";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import { CheckIcon, PlusIcon, SignOutIcon, TrashIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const { workspace, accounts, workspaces, reload, appConfig, billing, isFeatureEnabled } = useLuca();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  /* Profile editing */
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileInput, setProfileInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    apiFetch<{ user: { email: string; name: string | null } }>("/api/settings")
      .then((data) => {
        setUserEmail(data.user.email);
        setUserName(data.user.name);
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
      setEditingProfile(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  }

  /* Workspace editing */
  const [wsName, setWsName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  /* Base currency editing */
  const [editingCurrency, setEditingCurrency] = useState(false);
  const [currencyInput, setCurrencyInput] = useState("");
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);

  /* New account form */
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: "", type: "CASH", currency: "" });
  const [savingAccount, setSavingAccount] = useState(false);

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

  const planType = billing?.subscriptions?.[0]?.plan?.type ?? "FREE";
  const planName = billing?.subscriptions?.[0]?.plan?.name ?? planType;
  const workspaceLimit =
    Number(billing?.entitlements.workspace_limit ?? 1) +
    Number(billing?.entitlements.extra_workspace_slots ?? 0);
  const memberInvitesEnabled = billing?.entitlements.member_invites_enabled === true;
  const memberLimit = Number(billing?.entitlements.member_limit_per_workspace ?? 1);

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

  async function signOut() {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  }

  async function saveName() {
    if (!workspace || !wsName.trim()) return;
    setSavingName(true);
    try {
      await apiFetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: wsName.trim() })
      });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
      setEditingName(false);
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
      setEditingCurrency(false);
      await reload();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCurrency(false);
    }
  }

  async function createAccount() {
    if (!workspace || !accountForm.name) return;
    setSavingAccount(true);
    try {
      await apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: accountForm.name,
          type: accountForm.type,
          currency: accountForm.currency || workspace.baseCurrency,
          initialBalance: 0
        })
      });
      setAccountForm({ name: "", type: "CASH", currency: "" });
      setShowAccountForm(false);
      await reload();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAccount(false);
    }
  }

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

  return (
    <div className="luca-page-wide space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">{t("settings.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
      <Section label={locale === "ru" ? "Доступ и версия" : "Access and version"}>
        <Row label={locale === "ru" ? "Тариф" : "Plan"}>
          <div>
            <div className="text-sm font-semibold text-[rgb(var(--foreground))]">{planName}</div>
            <div className="text-xs text-[rgb(var(--muted))]">
              {workspaces.length}/{workspaceLimit || "∞"} {locale === "ru" ? "воркспейсов" : "workspaces"}
            </div>
          </div>
        </Row>
        <Row label={locale === "ru" ? "Версия" : "Version"}>
          <span className="font-mono text-sm text-[rgb(var(--muted))]">{appConfig.version}</span>
        </Row>
        <Row label="Feature flags">
          <div className="flex flex-wrap justify-end gap-1.5">
            {Object.entries(appConfig.flags).map(([key, enabled]) => (
              <span
                key={key}
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  enabled
                    ? "bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]"
                    : "bg-[rgb(var(--surface-soft))] text-[rgb(var(--muted))]",
                ].join(" ")}
              >
                {key}
              </span>
            ))}
          </div>
        </Row>
      </Section>

      {/* Profile */}
      <Section label={t("settings.profile")}>
        <Row label={t("settings.email")}>
          <span className="text-sm text-[rgb(var(--muted))]">{userEmail ?? "…"}</span>
        </Row>
        <Row label={t("settings.displayName")}>
          {editingProfile ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={profileInput}
                onChange={(e) => setProfileInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveProfile();
                  if (e.key === "Escape") setEditingProfile(false);
                }}
                placeholder={t("settings.displayNamePlaceholder")}
                className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2.5 py-1.5 text-sm outline-none focus:border-[rgb(var(--accent))]"
              />
              <button
                onClick={saveProfile}
                disabled={savingProfile || !profileInput.trim()}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--foreground))] text-[rgb(var(--background))] disabled:opacity-40"
              >
                <CheckIcon size={13} weight="bold" />
              </button>
              <button
                onClick={() => setEditingProfile(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))]"
              >
                <span className="text-xs">✕</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setProfileInput(userName ?? "");
                setEditingProfile(true);
              }}
              className="flex items-center gap-1.5 text-sm text-[rgb(var(--muted))] transition hover:text-[rgb(var(--foreground))]"
            >
              {profileSaved ? (
                <span className="flex items-center gap-1 text-[rgb(var(--positive))]">
                  <CheckIcon size={12} weight="bold" /> {t("settings.saved")}
                </span>
              ) : (
                userName || <span className="italic opacity-50">{t("settings.notSet")}</span>
              )}
            </button>
          )}
        </Row>
      </Section>

      {/* Appearance */}
      <Section label={t("settings.appearance")}>
        <Row label={t("common.theme")}>
          <ThemeSwitcher />
        </Row>
        <Row label={t("common.language")}>
          <LanguageSwitcher />
        </Row>
      </Section>

      {/* Workspace */}
      <Section label={t("settings.workspace")}>
        <Row label={t("settings.workspaceName")}>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2.5 py-1.5 text-sm outline-none focus:border-[rgb(var(--accent))]"
              />
              <button
                onClick={saveName}
                disabled={savingName}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--foreground))] text-[rgb(var(--background))] disabled:opacity-40"
              >
                <CheckIcon size={13} weight="bold" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setWsName(workspace?.name ?? "");
                setEditingName(true);
              }}
              className="flex items-center gap-1.5 text-sm text-[rgb(var(--muted))] transition hover:text-[rgb(var(--foreground))]"
            >
              {nameSaved ? (
                <span className="flex items-center gap-1 text-[rgb(var(--positive))]">
                  <CheckIcon size={12} weight="bold" /> {t("settings.saved")}
                </span>
              ) : (
                workspace?.name ?? "—"
              )}
            </button>
          )}
        </Row>
        <Row label={t("settings.currency")}>
          {editingCurrency ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={currencyInput}
                onChange={(e) => setCurrencyInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCurrency();
                  if (e.key === "Escape") setEditingCurrency(false);
                }}
                maxLength={3}
                placeholder="USD"
                className="w-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2.5 py-1.5 text-sm font-mono uppercase outline-none focus:border-[rgb(var(--accent))]"
              />
              <button
                onClick={saveCurrency}
                disabled={savingCurrency || currencyInput.trim().length !== 3}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--foreground))] text-[rgb(var(--background))] disabled:opacity-40"
              >
                <CheckIcon size={13} weight="bold" />
              </button>
              <button
                onClick={() => setEditingCurrency(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))]"
              >
                <span className="text-xs">✕</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setCurrencyInput(workspace?.baseCurrency ?? "");
                setEditingCurrency(true);
              }}
              className="flex items-center gap-1.5 text-sm text-[rgb(var(--muted))] transition hover:text-[rgb(var(--foreground))]"
            >
              {currencySaved ? (
                <span className="flex items-center gap-1 text-[rgb(var(--positive))]">
                  <CheckIcon size={12} weight="bold" /> {t("settings.saved")}
                </span>
              ) : (
                <span className="font-mono">{workspace?.baseCurrency ?? "—"}</span>
              )}
            </button>
          )}
        </Row>
      </Section>

      {isFeatureEnabled("workspaceMembers") && (
        <Section label={locale === "ru" ? "Команда" : "Team"}>
          <div className="space-y-3 p-4">
            <div className="rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{locale === "ru" ? "Участники" : "Members"}</div>
                  <div className="text-xs text-[rgb(var(--muted))]">
                    {members.length}/{memberLimit || "∞"} · {memberInvitesEnabled ? planType : locale === "ru" ? "нужен Business" : "Business required"}
                  </div>
                </div>
                {teamLoading && <span className="text-xs text-[rgb(var(--muted))]">{t("common.loading")}</span>}
              </div>
            </div>

            {memberInvitesEnabled && (
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_auto]">
                <input
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="h-10 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
                />
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as "ADMIN" | "MEMBER" | "VIEWER" }))}
                  className="h-10 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <button
                  onClick={inviteMember}
                  disabled={teamSaving || !inviteForm.email.trim()}
                  className="h-10 rounded-lg bg-[rgb(var(--foreground))] px-4 text-sm font-medium text-[rgb(var(--background))] disabled:opacity-40"
                >
                  {locale === "ru" ? "Пригласить" : "Invite"}
                </button>
              </div>
            )}

            <div className="divide-y divide-[rgb(var(--border-soft))] overflow-hidden rounded-lg border border-[rgb(var(--border-soft))]">
              {members.map((member) => (
                <div key={member.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{member.user.name || member.user.email || member.user.id}</div>
                    <div className="truncate text-xs text-[rgb(var(--muted))]">{member.user.email ?? member.user.id}</div>
                  </div>
                  {member.role === "OWNER" ? (
                    <span className="rounded-full bg-[rgb(var(--surface-soft))] px-2 py-1 text-xs font-semibold text-[rgb(var(--muted))]">OWNER</span>
                  ) : (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => updateMemberRole(member.id, e.target.value as "ADMIN" | "MEMBER" | "VIEWER")}
                        className="h-8 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-xs outline-none"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="MEMBER">MEMBER</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                      <button
                        onClick={() => removeMember(member.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
                        title={t("common.delete")}
                      >
                        <TrashIcon size={13} weight="bold" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {invitations.filter((i) => i.status === "PENDING").length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                  {locale === "ru" ? "Ожидают принятия" : "Pending invites"}
                </div>
                {invitations.filter((i) => i.status === "PENDING").map((invitation) => {
                  const inviteLink =
                    typeof window === "undefined"
                      ? ""
                      : `${window.location.origin}/${locale}/app/invitations/${invitation.token}`;
                  return (
                    <div key={invitation.id} className="rounded-lg border border-[rgb(var(--border-soft))] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{invitation.email}</div>
                          <div className="text-xs text-[rgb(var(--muted))]">{invitation.role}</div>
                          {inviteLink && (
                            <button
                              onClick={() => navigator.clipboard?.writeText(inviteLink)}
                              className="mt-1 truncate text-xs text-[rgb(var(--accent))]"
                            >
                              {inviteLink}
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => revokeInvitation(invitation.id)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]"
                        >
                          <XIcon size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Account / Logout */}
      <Section label={t("settings.dangerZone")}>
        <Row label={t("common.logout")}>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--negative))] transition hover:opacity-75"
          >
            <SignOutIcon size={14} weight="bold" />
            {t("common.logout")}
          </button>
        </Row>
      </Section>
        </div>

        <div className="space-y-4">
      {/* Accounts */}
      <Section label={t("settings.accounts")}>
        {accounts.map((acc) => (
          <Row key={acc.id} label={acc.name}>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums text-[rgb(var(--foreground))]">
                {acc.currency}{" "}
                {Number(acc.currentBalance).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
            </div>
          </Row>
        ))}

        {showAccountForm ? (
          <div className="border-t border-[rgb(var(--border-soft))] p-4">
            <div className="space-y-3">
              <input
                autoFocus
                value={accountForm.name}
                onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("settings.accountName")}
                className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-2 text-sm outline-none focus:border-[rgb(var(--accent))]"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={accountForm.type}
                  onChange={(e) => setAccountForm((f) => ({ ...f, type: e.target.value }))}
                  className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-2 text-sm outline-none focus:border-[rgb(var(--accent))]"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="BANK">Bank</option>
                  <option value="WISE">Wise</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="CRYPTO">Crypto</option>
                  <option value="OTHER">Other</option>
                </select>
                <input
                  value={accountForm.currency}
                  onChange={(e) =>
                    setAccountForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))
                  }
                  placeholder={workspace?.baseCurrency ?? "USD"}
                  maxLength={3}
                  className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-2 text-sm uppercase outline-none focus:border-[rgb(var(--accent))]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createAccount}
                  disabled={savingAccount || !accountForm.name}
                  className="flex-1 rounded-lg bg-[rgb(var(--foreground))] py-2 text-sm font-medium text-[rgb(var(--background))] disabled:opacity-40"
                >
                  {savingAccount ? t("common.loading") : t("common.save")}
                </button>
                <button
                  onClick={() => setShowAccountForm(false)}
                  className="rounded-lg border border-[rgb(var(--border))] px-4 py-2 text-sm text-[rgb(var(--muted))]"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-[rgb(var(--border-soft))]">
            <button
              onClick={() => setShowAccountForm(true)}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
            >
              <PlusIcon size={14} weight="bold" />
              {t("settings.addAccount")}
            </button>
          </div>
        )}
      </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="luca-panel">
      <div className="border-b border-[rgb(var(--border-soft))] px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-[rgb(var(--foreground))]">{label}</span>
      <div className="sm:text-right">{children}</div>
    </div>
  );
}
