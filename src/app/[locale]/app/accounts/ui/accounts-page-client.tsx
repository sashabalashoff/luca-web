"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { Modal } from "@/shared/ui/modal";
import {
  ArchiveIcon,
  BankIcon,
  CheckIcon,
  CurrencyBtcIcon,
  CurrencyDollarIcon,
  PencilIcon,
  PlusIcon,
  XIcon,
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

const ACCOUNT_TYPES: Account["type"][] = ["CASH", "CARD", "BANK", "WISE", "PAYPAL", "CRYPTO", "OTHER"];

const ACCOUNT_TYPE_META: Record<Account["type"], { label: string; emoji: string }> = {
  CASH: { label: "Cash", emoji: "💵" },
  CARD: { label: "Card", emoji: "💳" },
  BANK: { label: "Bank", emoji: "🏦" },
  WISE: { label: "Wise", emoji: "🌍" },
  PAYPAL: { label: "PayPal", emoji: "🅿️" },
  CRYPTO: { label: "Crypto", emoji: "₿" },
  OTHER: { label: "Other", emoji: "🪙" },
};

const CURRENCIES = [
  "USD", "EUR", "RUB", "GBP", "AED", "CNY", "JPY", "TRY", "KZT", "UAH",
  "CAD", "AUD", "CHF", "INR", "BRL", "MXN", "SGD", "HKD", "PLN", "CZK",
  "SEK", "NOK", "DKK", "HUF", "RON", "BTC", "ETH", "USDT", "SOL", "TON",
];

const defaultForm = (currency: string): AccountForm => ({
  name: "",
  type: "BANK",
  currency,
  initialBalance: "0",
  isDebt: false,
  creditLimit: "",
});

function fmt(balance: string | number, currency: string) {
  const n = Number(balance);
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── Account icon ─────────────────────────────────── */
function AccountIcon({ type, isDebt }: { type: Account["type"]; isDebt: boolean }) {
  if (isDebt) return <CurrencyDollarIcon size={18} weight="bold" className="text-[rgb(var(--negative))]" />;
  if (type === "CRYPTO") return <CurrencyBtcIcon size={18} weight="bold" />;
  if (type === "BANK" || type === "WISE") return <BankIcon size={18} weight="bold" />;
  return <span className="text-base leading-none">{ACCOUNT_TYPE_META[type].emoji}</span>;
}

/* ── Account form fields ─────────────────────────── */
function AccountFormFields({
  form,
  onChange,
  t,
}: {
  form: AccountForm;
  onChange: (patch: Partial<AccountForm>) => void;
  t: (key: string) => string;
}) {
  const showCreditFields = form.type === "CARD" || form.isDebt;

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("accounts.name")}</label>
        <input
          autoFocus
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="My Bank Account"
          className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("accounts.type")}</label>
          <select
            value={form.type}
            onChange={(e) => onChange({ type: e.target.value as AccountForm["type"] })}
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACCOUNT_TYPE_META[type].emoji} {ACCOUNT_TYPE_META[type].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("accounts.currency")}</label>
          <select
            value={CURRENCIES.includes(form.currency) ? form.currency : ""}
            onChange={(e) => onChange({ currency: e.target.value })}
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            {!CURRENCIES.includes(form.currency) && form.currency && (
              <option value={form.currency}>{form.currency}</option>
            )}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("accounts.balance")}</label>
        <input
          type="number" step="any"
          value={form.initialBalance}
          onChange={(e) => onChange({ initialBalance: e.target.value })}
          placeholder="0.00"
          className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
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
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("accounts.creditLimit")}</label>
          <input
            type="number" step="any" min="0"
            value={form.creditLimit}
            onChange={(e) => onChange({ creditLimit: e.target.value })}
            placeholder="5000"
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
          />
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────── */
export function AccountsPageClient() {
  const { t, locale } = useI18n();
  const { workspace } = useLuca();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AccountForm>(defaultForm("USD"));

  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState<AccountForm>(defaultForm("USD"));
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);

  function loadAccounts() {
    if (!workspace) return;
    setLoading(true);
    apiFetch<{ accounts: Account[] }>(`/api/accounts?workspaceId=${workspace.id}`)
      .then((r) => setAccounts(r.accounts.filter((a) => !a.isArchived)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAccounts(); }, [workspace]);

  useEffect(() => {
    if (workspace) setForm(defaultForm(workspace.baseCurrency));
  }, [workspace]);

  async function createAccount() {
    if (!workspace || !form.name) return;
    setSaving(true);
    try {
      await apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: form.name,
          type: form.type,
          currency: form.currency,
          initialBalance: Number(form.initialBalance),
          isDebt: form.isDebt,
          creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
        }),
      });
      setShowAddModal(false);
      setForm(defaultForm(workspace.baseCurrency));
      loadAccounts();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(account: Account) {
    setEditingAccount(account);
    setEditForm({
      name: account.name,
      type: account.type,
      currency: account.currency,
      initialBalance: account.initialBalance,
      isDebt: account.isDebt,
      creditLimit: account.creditLimit ?? "",
    });
    setArchiveConfirmId(null);
  }

  async function saveEdit() {
    if (!editingAccount) return;
    setSaving(true);
    try {
      await apiFetch(`/api/accounts/${editingAccount.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          type: editForm.type,
          currency: editForm.currency,
          isDebt: editForm.isDebt,
          creditLimit: editForm.creditLimit ? Number(editForm.creditLimit) : null,
        }),
      });
      setEditingAccount(null);
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
        body: JSON.stringify({ isArchived: true }),
      });
      setArchiveConfirmId(null);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const [netWorthData, setNetWorthData] = useState<{ totalAssets: number; totalLiabilities: number; baseCurrency: string } | null>(null);

  useEffect(() => {
    if (!workspace) return;
    apiFetch<{ totalAssets: number; totalLiabilities: number; baseCurrency: string }>(`/api/reports/net-worth?workspaceId=${workspace.id}`)
      .then((r) => setNetWorthData(r))
      .catch(console.error);
  }, [workspace, accounts]);

  const baseCurrency = workspace?.baseCurrency ?? "USD";
  const totalAssets = netWorthData?.totalAssets ?? 0;
  const totalDebt = netWorthData ? -netWorthData.totalLiabilities : 0;
  const netWorth = totalAssets + totalDebt;

  return (
    <div className="luca-page space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("accounts.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("accounts.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[rgb(var(--foreground))] px-4 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 active:scale-[0.97]"
        >
          <PlusIcon size={14} weight="bold" />
          <span className="hidden sm:inline">{t("accounts.add")}</span>
        </button>
      </div>

      {/* Summary cards */}
      {!loading && accounts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="luca-panel p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
              {locale === "ru" ? "Активы" : "Assets"}
            </div>
            <div className="text-lg font-bold tabular-nums text-[rgb(var(--positive))]">
              {fmt(totalAssets, baseCurrency)}
            </div>
          </div>
          {totalDebt !== 0 && (
            <div className="luca-panel p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                {locale === "ru" ? "Долги" : "Debts"}
              </div>
              <div className="text-lg font-bold tabular-nums text-[rgb(var(--negative))]">
                {fmt(Math.abs(totalDebt), baseCurrency)}
              </div>
            </div>
          )}
          <div className="luca-panel p-4 col-span-2 lg:col-span-1">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
              {locale === "ru" ? "Чистая стоимость" : "Net worth"}
            </div>
            <div className={["text-lg font-bold tabular-nums", netWorth >= 0 ? "text-[rgb(var(--foreground))]" : "text-[rgb(var(--negative))]"].join(" ")}>
              {fmt(netWorth, baseCurrency)}
            </div>
            <div className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              {accounts.length} {locale === "ru" ? "счёт(а)" : "account(s)"}
            </div>
          </div>
        </div>
      )}

      {/* Accounts list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-20 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--surface-soft))]">
            <span className="text-2xl opacity-30">🏦</span>
          </div>
          <p className="text-sm text-[rgb(var(--muted))]">{t("accounts.empty")}</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 flex h-9 items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-3 text-sm text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))]"
          >
            <PlusIcon size={14} weight="bold" />
            {t("accounts.add")}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          {accounts.map((account, idx) => (
            <div
              key={account.id}
              className={[
                "group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[rgb(var(--surface-soft))]",
                idx < accounts.length - 1 ? "border-b border-[rgb(var(--border-soft))]" : "",
              ].join(" ")}
            >
              {/* Icon */}
              <div className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                account.isDebt ? "bg-[rgb(var(--negative-dim))]" : "bg-[rgb(var(--surface-soft))]",
              ].join(" ")}>
                <AccountIcon type={account.type} isDebt={account.isDebt} />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[rgb(var(--foreground))]">{account.name}</span>
                  <span className="rounded-md bg-[rgb(var(--surface-soft))] px-1.5 py-0.5 text-[10px] font-medium text-[rgb(var(--muted))]">
                    {ACCOUNT_TYPE_META[account.type].label}
                  </span>
                  {account.isDebt && (
                    <span className="rounded-md bg-[rgb(var(--negative-dim))] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--negative))]">
                      {t("accounts.debtBadge")}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[rgb(var(--muted))]">
                  <span className={["tabular-nums font-medium",
                    Number(account.currentBalance) >= 0 ? "text-[rgb(var(--positive))]" : "text-[rgb(var(--negative))]",
                  ].join(" ")}>
                    {Number(account.currentBalance) >= 0 ? "" : "−"}
                    {fmt(Math.abs(Number(account.currentBalance)), account.currency)}
                  </span>
                  {account.creditLimit && Number(account.creditLimit) > 0 && (
                    <span>
                      {t("accounts.creditLimit")}: {fmt(account.creditLimit, account.currency)}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {archiveConfirmId === account.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="hidden text-xs text-[rgb(var(--muted))] sm:inline">
                    {t("accounts.archiveConfirm")}
                  </span>
                  <button
                    onClick={() => archiveAccount(account.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))] transition hover:opacity-80"
                  >
                    <CheckIcon size={12} weight="bold" />
                  </button>
                  <button
                    onClick={() => setArchiveConfirmId(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
                  >
                    <XIcon size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => startEdit(account)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
                    title={t("accounts.edit")}
                  >
                    <PencilIcon size={14} weight="bold" />
                  </button>
                  <button
                    onClick={() => { setArchiveConfirmId(account.id); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
                    title={t("accounts.archiveConfirm")}
                  >
                    <ArchiveIcon size={14} weight="bold" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setForm(defaultForm(workspace?.baseCurrency ?? "USD")); }}
        title={t("accounts.add")}
        maxWidth="sm"
        footer={
          <button
            onClick={createAccount}
            disabled={saving || !form.name}
            className="h-11 w-full rounded-xl bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
          >
            {saving ? t("common.loading") : t("common.save")}
          </button>
        }
      >
        <AccountFormFields form={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} t={t} />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editingAccount}
        onClose={() => setEditingAccount(null)}
        title={t("accounts.edit")}
        maxWidth="sm"
        footer={
          <button
            onClick={saveEdit}
            disabled={saving || !editForm.name}
            className="h-11 w-full rounded-xl bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
          >
            {saving ? t("common.loading") : t("common.save")}
          </button>
        }
      >
        <AccountFormFields form={editForm} onChange={(p) => setEditForm((f) => ({ ...f, ...p }))} t={t} />
      </Modal>
    </div>
  );
}
