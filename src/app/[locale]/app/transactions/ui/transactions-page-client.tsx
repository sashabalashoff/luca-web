"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowsLeftRightIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  XIcon
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";

type Transaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: string;
  currency: string;
  date: string;
  merchant?: string | null;
  comment?: string | null;
  category?: { name: string; icon?: string | null } | null;
  account?: { id: string; name: string } | null;
};

type Category = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  icon?: string | null;
};

type DayGroup = {
  label: string;
  iso: string;
  items: Transaction[];
};

type Filter = "ALL" | "INCOME" | "EXPENSE";

function groupByDay(txs: Transaction[]): DayGroup[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const key = tx.date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([iso, items]) => ({
      iso,
      label: new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric"
      }),
      items
    }));
}

const today = new Date().toISOString().split("T")[0];

export function TransactionsPageClient() {
  const { t, locale } = useI18n();
  const { workspace, accounts, defaultAccount, isLoading: bootstrapLoading, reload: reloadContext } = useLuca();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");

  /* Add form */
  const [showAddForm, setShowAddForm] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [savingTx, setSavingTx] = useState(false);
  const [addForm, setAddForm] = useState({
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    amount: "",
    categoryId: "",
    merchant: "",
    comment: "",
    date: today,
    accountId: ""
  });

  function loadTransactions() {
    if (!workspace) return;
    setLoading(true);
    apiFetch<{ transactions: Transaction[] }>(
      `/api/transactions?workspaceId=${workspace.id}`
    )
      .then((r) => setTransactions(r.transactions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTransactions();
  }, [workspace]);

  // Load categories when add form opens
  useEffect(() => {
    if (!showAddForm || !workspace || categories.length > 0) return;
    apiFetch<{ categories: Category[] }>(`/api/categories?workspaceId=${workspace.id}`)
      .then((r) => setCategories(r.categories))
      .catch(console.error);
  }, [showAddForm, workspace]);

  // Pre-fill accountId when defaultAccount loads
  useEffect(() => {
    if (defaultAccount && !addForm.accountId) {
      setAddForm((f) => ({ ...f, accountId: defaultAccount.id }));
    }
  }, [defaultAccount]);

  async function deleteTransaction(id: string) {
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
      reloadContext();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  async function createTransaction() {
    if (!workspace || !addForm.amount) return;
    const accountId = addForm.accountId || defaultAccount?.id;
    if (!accountId) return;

    setSavingTx(true);
    try {
      await apiFetch("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: workspace.id,
          accountId,
          type: addForm.type,
          amount: Number(addForm.amount),
          currency:
            accounts.find((a) => a.id === accountId)?.currency ??
            workspace.baseCurrency,
          date: addForm.date,
          categoryId: addForm.categoryId || null,
          merchant: addForm.merchant || null,
          comment: addForm.comment || null,
          source: "MANUAL"
        })
      });
      setShowAddForm(false);
      setAddForm({
        type: "EXPENSE",
        amount: "",
        categoryId: "",
        merchant: "",
        comment: "",
        date: today,
        accountId: defaultAccount?.id ?? ""
      });
      loadTransactions();
      reloadContext();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTx(false);
    }
  }

  const filtered = filter === "ALL" ? transactions : transactions.filter((tx) => tx.type === filter);
  const groups = groupByDay(filtered);
  const isSpinning = bootstrapLoading || loading;

  const txCountLabel = (n: number) =>
    locale === "ru"
      ? `${n} ${n === 1 ? "операция" : n < 5 ? "операции" : "операций"}`
      : `${n} ${n === 1 ? "transaction" : "transactions"}`;

  const filteredCategories = categories.filter(
    (c) => c.type === addForm.type || c.type === "TRANSFER"
  );

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("transactions.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("transactions.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.97]"
        >
          {showAddForm ? <XIcon size={14} weight="bold" /> : <PlusIcon size={14} weight="bold" />}
          {t("transactions.new")}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <div className="border-b border-[rgb(var(--border-soft))] px-5 py-4">
            <span className="text-sm font-semibold">{t("transactions.addTitle")}</span>
          </div>
          <div className="space-y-4 p-5">
            {/* Type selector */}
            <div className="flex gap-2">
              {(["EXPENSE", "INCOME"] as const).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setAddForm((f) => ({ ...f, type: tp, categoryId: "" }))}
                  className={[
                    "flex-1 rounded-lg border py-2 text-sm font-medium transition",
                    addForm.type === tp
                      ? tp === "EXPENSE"
                        ? "border-[rgb(var(--negative))] bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))]"
                        : "border-[rgb(var(--positive))] bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]"
                      : "border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]"
                  ].join(" ")}
                >
                  {tp === "EXPENSE" ? t("transactions.expense") : t("transactions.income")}
                </button>
              ))}
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                  {t("transactions.amount")} ({workspace?.baseCurrency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={addForm.amount}
                  onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                  {t("transactions.dateLabel")}
                </label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                Category
              </label>
              <select
                value={addForm.categoryId}
                onChange={(e) => setAddForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              >
                <option value="">— no category —</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}{c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Merchant */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                {t("transactions.merchantLabel")}
              </label>
              <input
                value={addForm.merchant}
                onChange={(e) => setAddForm((f) => ({ ...f, merchant: e.target.value }))}
                placeholder="Nobu, Netflix..."
                className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
              />
            </div>

            {/* Account */}
            {accounts.length > 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                  Account
                </label>
                <select
                  value={addForm.accountId}
                  onChange={(e) => setAddForm((f) => ({ ...f, accountId: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={createTransaction}
                disabled={savingTx || !addForm.amount}
                className="flex-1 rounded-lg bg-[rgb(var(--foreground))] py-2.5 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
              >
                {savingTx ? t("common.loading") : t("common.save")}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="rounded-lg border border-[rgb(var(--border))] px-4 py-2.5 text-sm text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1">
        {(["ALL", "INCOME", "EXPENSE"] as Filter[]).map((f) => {
          const label =
            f === "ALL"
              ? t("transactions.filterAll")
              : f === "INCOME"
                ? t("transactions.income")
                : t("transactions.expense");
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                filter === f
                  ? "bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                  : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
        {!isSpinning && transactions.length > 0 && (
          <span className="ml-auto self-center text-xs text-[rgb(var(--muted-soft))]">
            {txCountLabel(filtered.length)}
          </span>
        )}
      </div>

      {/* Content */}
      {isSpinning ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--surface-soft))]">
            <span className="text-3xl opacity-30">💸</span>
          </div>
          <p className="text-sm text-[rgb(var(--muted))]">{t("transactions.empty")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.iso}>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-[rgb(var(--muted))]">
                  {group.label}
                </span>
                <span className="text-xs text-[rgb(var(--muted-soft))]">
                  {txCountLabel(group.items.length)}
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
                {group.items.map((tx, idx) => (
                  <TxRow
                    key={tx.id}
                    tx={tx}
                    isLast={idx === group.items.length - 1}
                    isDeleting={deletingId === tx.id}
                    confirmingDelete={confirmDeleteId === tx.id}
                    onDeleteRequest={() =>
                      setConfirmDeleteId((prev) => (prev === tx.id ? null : tx.id))
                    }
                    onDeleteConfirm={() => deleteTransaction(tx.id)}
                    onDeleteCancel={() => setConfirmDeleteId(null)}
                    t={t}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TxRow({
  tx,
  isLast,
  isDeleting,
  confirmingDelete,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  t
}: {
  tx: Transaction;
  isLast: boolean;
  isDeleting: boolean;
  confirmingDelete: boolean;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  t: (key: string) => string;
}) {
  const isExpense = tx.type === "EXPENSE";
  const isIncome = tx.type === "INCOME";
  const amount = Number(tx.amount);
  const label = tx.merchant || tx.category?.name || tx.comment || tx.type;
  const sub = tx.merchant && tx.category?.name ? tx.category.name : tx.account?.name ?? null;

  const iconBg = isExpense
    ? "bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))]"
    : isIncome
      ? "bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]"
      : "bg-[rgb(var(--surface-soft))] text-[rgb(var(--muted))]";

  const amountColor = isExpense
    ? "text-[rgb(var(--negative))]"
    : isIncome
      ? "text-[rgb(var(--positive))]"
      : "text-[rgb(var(--foreground))]";

  return (
    <div
      className={[
        "group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[rgb(var(--surface-soft))]",
        !isLast ? "border-b border-[rgb(var(--border-soft))]" : "",
        isDeleting ? "opacity-40" : ""
      ].join(" ")}
    >
      {/* Icon */}
      <div className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm", iconBg].join(" ")}>
        {tx.category?.icon ? (
          <span className="leading-none">{tx.category.icon}</span>
        ) : isExpense ? (
          <ArrowDownIcon size={15} weight="bold" />
        ) : isIncome ? (
          <ArrowUpIcon size={15} weight="bold" />
        ) : (
          <ArrowsLeftRightIcon size={15} weight="bold" />
        )}
      </div>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[rgb(var(--foreground))]">{label}</div>
        {sub && (
          <div className="truncate text-xs text-[rgb(var(--muted))]">{sub}</div>
        )}
      </div>

      {/* Amount */}
      <div className={["shrink-0 text-sm font-semibold tabular-nums", amountColor].join(" ")}>
        {isExpense ? "−" : isIncome ? "+" : ""}
        {amount.toFixed(2)} {tx.currency}
      </div>

      {/* Delete controls */}
      {confirmingDelete ? (
        <div className="ml-1 flex items-center gap-1">
          <span className="text-xs text-[rgb(var(--muted))]">{t("transactions.confirmDeleteQ")}</span>
          <button
            onClick={onDeleteConfirm}
            disabled={isDeleting}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))] transition hover:opacity-80"
          >
            <CheckIcon size={11} weight="bold" />
          </button>
          <button
            onClick={onDeleteCancel}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
          >
            <XIcon size={11} />
          </button>
        </div>
      ) : (
        <button
          onClick={onDeleteRequest}
          disabled={isDeleting}
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--muted))] opacity-0 transition-all hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))] group-hover:opacity-100 disabled:opacity-30"
          title={t("common.delete")}
        >
          <TrashIcon size={13} weight="bold" />
        </button>
      )}
    </div>
  );
}
