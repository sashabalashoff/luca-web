"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { useLuca } from "@/shared/providers/luca-provider";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import { CheckIcon, PlusIcon, SignOutIcon } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const { workspace, accounts, reload } = useLuca();
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

  return (
    <div className="max-w-xl space-y-4">
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

      {/* Account / Logout */}
      <Section label={t("settings.account")}>
        <Row label={t("common.logout")}>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-[rgb(var(--negative))] transition hover:opacity-75"
          >
            <SignOutIcon size={14} weight="bold" />
            {t("common.logout")}
          </button>
        </Row>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="border-b border-[rgb(var(--border-soft))] px-4 py-3">
        <span className="text-xs font-semibold text-[rgb(var(--muted))]">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-[rgb(var(--foreground))]">{label}</span>
      {children}
    </div>
  );
}
