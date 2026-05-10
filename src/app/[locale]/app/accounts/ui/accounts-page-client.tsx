"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  ArchiveIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  XIcon
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";

type Account = {
  id: string;
  workspaceId: string;
  name: string;
  type: "CASH" | "CARD" | "BANK" | "WISE" | "PAYPAL" | "CRYPTO" | "OTHER";
  currency: string;
  initialBalance: string;
  currentBalance: string;
  creditLimit?: string | null;
  isDebt: boolean;
  isArchived: boolean;
};

type AccountForm = {
  name: string;
  type: Account["type"];
  currency: string;
  initialBalance: string;
  isDebt: boolean;
  creditLimit: string;
};

const ACCOUNT_TYPES: Account["type"][] = [
  "CASH",
  "CARD",
  "BANK",
  "WISE",
  "PAYPAL",
  "CRYPTO",
  "OTHER"
];

const defaultForm = (currency: string): AccountForm => ({
  name: "",
  type: "BANK",
  currency,
  initialBalance: "0",
  isDebt: false,
  creditLimit: ""
});

export function AccountsPageClient() {
  const { t } = useI18n();
  const { workspace } = useLuca();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AccountForm>(defaultForm("USD"));

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AccountForm>(defaultForm("USD"));

  // Archive confirm
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);

  function loadAccounts() {
    if (!workspace) return;
    setLoading(true);
    apiFetch<{ accounts: Account[] }>(`/api/accounts?workspaceId=${workspace.id}`)
      .then((r) => setAccounts(r.accounts.filter((a) => !a.isArchived)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAccounts();
  }, [workspace]);

  useEffect(() => {
    if (workspace) {
      setForm(defaultForm(workspace.baseCurrency));
    }
  }, [workspace]);

  async function createAccount() {
    if (!workspace || !form.name) return;
    setSaving(true);
    try {
      await apiFetch<{ account: Account }>("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: form.name,
          type: form.type,
          currency: form.currency,
          initialBalance: Number(form.initialBalance),
          isDebt: form.isDebt,
          creditLimit: form.creditLimit ? Number(form.creditLimit) : null
        })
      });
      setForm(defaultForm(workspace.baseCurrency));
      setShowForm(false);
      loadAccounts();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(account: Account) {
    setEditingId(account.id);
    setEditForm({
      name: account.name,
      type: account.type,
      currency: account.currency,
      initialBalance: account.initialBalance,
      isDebt: account.isDebt,
      creditLimit: account.creditLimit ?? ""
    });
    setArchiveConfirmId(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await apiFetch<{ account: Account }>(`/api/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          type: editForm.type,
          currency: editForm.currency,
          isDebt: editForm.isDebt,
          creditLimit: editForm.creditLimit ? Number(editForm.creditLimit) : null
        })
      });
      setEditingId(null);
      loadAccounts();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function archiveAccount(id: string) {
    try {
      await apiFetch(`/api/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: true })
      });
      setArchiveConfirmId(null);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const showCreditFields = (f: AccountForm) =>
    f.type === "CARD" || f.isDebt;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("accounts.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("accounts.subtitle")}</p>
        </div>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setEditingId(null);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.97]"
        >
          {showForm ? <XIcon size={14} weight="bold" /> : <PlusIcon size={14} weight="bold" />}
          {t("accounts.add")}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border-soft))] px-5 py-4">
            <span className="text-sm font-semibold">{t("accounts.add")}</span>
            <button
              onClick={() => setShowForm(false)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
            >
              <XIcon size={13} />
            </button>
          </div>
          <div className="space-y-4 p-5">
            <AccountFormFields
              form={form}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              t={t}
            />
            <button
              onClick={createAccount}
              disabled={saving || !form.name}
              className="h-10 w-full rounded-lg bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
            >
              {saving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
            />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-20 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--surface-soft))]">
            <span className="text-2xl opacity-30">🏦</span>
          </div>
          <p className="text-sm text-[rgb(var(--muted))]">{t("accounts.empty")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          {accounts.map((account, idx) => (
            <div key={account.id}>
              {editingId === account.id ? (
                /* Inline edit form */
                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{t("accounts.edit")}</span>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
                    >
                      <XIcon size={13} />
                    </button>
                  </div>
                  <AccountFormFields
                    form={editForm}
                    onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                    t={t}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(account.id)}
                      disabled={saving || !editForm.name}
                      className="flex-1 rounded-lg bg-[rgb(var(--foreground))] py-2.5 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
                    >
                      {saving ? t("common.loading") : t("common.save")}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-[rgb(var(--border))] px-4 py-2.5 text-sm text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal account row */
                <div
                  className={[
                    "group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[rgb(var(--surface-soft))]",
                    idx < accounts.length - 1 ? "border-b border-[rgb(var(--border-soft))]" : ""
                  ].join(" ")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[rgb(var(--foreground))]">
                        {account.name}
                      </span>
                      <span className="rounded-md bg-[rgb(var(--surface-soft))] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
                        {account.type}
                      </span>
                      {account.isDebt && (
                        <span className="rounded-md bg-[rgb(var(--negative-dim))] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--negative))]">
                          {t("accounts.debtBadge")}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-[rgb(var(--muted))]">
                      <span className="tabular-nums">
                        {t("accounts.balance")}:{" "}
                        <span
                          className={
                            Number(account.currentBalance) >= 0
                              ? "font-medium text-[rgb(var(--positive))]"
                              : "font-medium text-[rgb(var(--negative))]"
                          }
                        >
                          {account.currency}{" "}
                          {Number(account.currentBalance).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </span>
                      {account.creditLimit && (
                        <span className="tabular-nums">
                          {t("accounts.creditLimit")}: {account.currency}{" "}
                          {Number(account.creditLimit).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {archiveConfirmId === account.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[rgb(var(--muted))]">
                        {t("accounts.archiveConfirm")}
                      </span>
                      <button
                        onClick={() => archiveAccount(account.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))] transition hover:opacity-80"
                      >
                        <CheckIcon size={11} weight="bold" />
                      </button>
                      <button
                        onClick={() => setArchiveConfirmId(null)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
                      >
                        <XIcon size={11} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => startEdit(account)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
                        title={t("accounts.edit")}
                      >
                        <PencilIcon size={13} weight="bold" />
                      </button>
                      <button
                        onClick={() => {
                          setArchiveConfirmId(account.id);
                          setEditingId(null);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
                        title={t("accounts.archiveConfirm")}
                      >
                        <ArchiveIcon size={13} weight="bold" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountFormFields({
  form,
  onChange,
  t
}: {
  form: AccountForm;
  onChange: (patch: Partial<AccountForm>) => void;
  t: (key: string) => string;
}) {
  const showCreditFields = form.type === "CARD" || form.isDebt;

  return (
    <>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
          {t("accounts.name")}
        </label>
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="My Bank Account"
          className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
            {t("accounts.type")}
          </label>
          <select
            value={form.type}
            onChange={(e) => onChange({ type: e.target.value as AccountForm["type"] })}
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          >
            {(["CASH", "CARD", "BANK", "WISE", "PAYPAL", "CRYPTO", "OTHER"] as const).map(
              (type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              )
            )}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
            {t("accounts.currency")}
          </label>
          <input
            value={form.currency}
            onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })}
            placeholder="USD"
            maxLength={3}
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
          {t("accounts.balance")}
        </label>
        <input
          type="number"
          step="any"
          value={form.initialBalance}
          onChange={(e) => onChange({ initialBalance: e.target.value })}
          placeholder="0.00"
          className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={form.isDebt}
          onChange={(e) => onChange({ isDebt: e.target.checked })}
          className="h-4 w-4 rounded border-[rgb(var(--border))] accent-[rgb(var(--accent))]"
        />
        <span className="text-sm text-[rgb(var(--foreground))]">{t("accounts.isDebt")}</span>
      </label>

      {showCreditFields && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
            {t("accounts.creditLimit")}
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={form.creditLimit}
            onChange={(e) => onChange({ creditLimit: e.target.value })}
            placeholder="5000"
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
          />
        </div>
      )}
    </>
  );
}
