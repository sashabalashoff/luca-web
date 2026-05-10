"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";

type Budget = {
  id: string;
  workspaceId: string;
  categoryId?: string | null;
  period: "MONTHLY" | "QUARTERLY" | "YEARLY";
  year: number;
  month?: number | null;
  amount: string;
  currency: string;
  category?: {
    id: string;
    name: string;
    type: string;
    icon?: string | null;
    color?: string | null;
  } | null;
};

type Category = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  icon?: string | null;
};

type BudgetForm = {
  categoryId: string;
  amount: string;
  currency: string;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const now = new Date();

export function BudgetPageClient() {
  const { t } = useI18n();
  const { workspace } = useLuca();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BudgetForm>({
    categoryId: "",
    amount: "",
    currency: workspace?.baseCurrency ?? "USD"
  });

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function loadBudgets() {
    if (!workspace) return;
    setLoading(true);
    apiFetch<{ budgets: Budget[] }>(
      `/api/budget?workspaceId=${workspace.id}&year=${year}&month=${month}`
    )
      .then((r) => setBudgets(r.budgets))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!workspace) return;
    apiFetch<{ categories: Category[] }>(`/api/categories?workspaceId=${workspace.id}`)
      .then((r) => setCategories(r.categories.filter((c) => c.type === "EXPENSE")))
      .catch(console.error);
  }, [workspace]);

  useEffect(() => {
    loadBudgets();
  }, [workspace, year, month]);

  useEffect(() => {
    if (workspace) {
      setForm((f) => ({ ...f, currency: workspace.baseCurrency }));
    }
  }, [workspace]);

  async function createBudget() {
    if (!workspace || !form.amount) return;
    setSaving(true);
    try {
      await apiFetch<{ budget: Budget }>("/api/budget", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: workspace.id,
          categoryId: form.categoryId || null,
          period: "MONTHLY",
          year,
          month,
          amount: Number(form.amount),
          currency: form.currency
        })
      });
      setForm({ categoryId: "", amount: "", currency: workspace.baseCurrency });
      setShowForm(false);
      loadBudgets();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await apiFetch<{ budget: Budget }>(`/api/budget/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ amount: Number(editAmount) })
      });
      setEditingId(null);
      loadBudgets();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBudget(id: string) {
    try {
      await apiFetch(`/api/budget/${id}`, { method: "DELETE" });
      setDeleteConfirmId(null);
      setBudgets((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("budget.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("budget.subtitle")}</p>
        </div>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setEditingId(null);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.97]"
        >
          {showForm ? <XIcon size={14} weight="bold" /> : <PlusIcon size={14} weight="bold" />}
          {t("budget.add")}
        </button>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[rgb(var(--muted))]">
            {t("budget.year")}
          </label>
          <input
            type="number"
            value={year}
            min={2000}
            max={2100}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-8 w-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[rgb(var(--muted))]">
            {t("budget.month")}
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="h-8 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border-soft))] px-5 py-4">
            <span className="text-sm font-semibold">{t("budget.add")}</span>
            <button
              onClick={() => setShowForm(false)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
            >
              <XIcon size={13} />
            </button>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                {t("budget.category")}
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              >
                <option value="">{t("budget.allCategories")}</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}{c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                  {t("budget.amount")}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="500"
                  className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                  {t("accounts.currency")}
                </label>
                <input
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                  placeholder="USD"
                  maxLength={3}
                  className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
                />
              </div>
            </div>

            <button
              onClick={createBudget}
              disabled={saving || !form.amount}
              className="h-10 w-full rounded-lg bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
            >
              {saving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      )}

      {/* Budget list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
            />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-20 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--surface-soft))]">
            <span className="text-2xl opacity-30">📊</span>
          </div>
          <p className="text-sm text-[rgb(var(--muted))]">{t("budget.empty")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          {budgets.map((budget, idx) => (
            <div
              key={budget.id}
              className={[
                idx < budgets.length - 1 ? "border-b border-[rgb(var(--border-soft))]" : ""
              ].join(" ")}
            >
              {editingId === budget.id ? (
                /* Inline edit */
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[rgb(var(--foreground))]">
                      {budget.category
                        ? `${budget.category.icon ? budget.category.icon + " " : ""}${budget.category.name}`
                        : t("budget.allCategories")}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="h-8 w-28 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
                    autoFocus
                  />
                  <button
                    onClick={() => saveEdit(budget.id)}
                    disabled={saving || !editAmount}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--foreground))] text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
                  >
                    <CheckIcon size={13} weight="bold" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
                  >
                    <XIcon size={13} />
                  </button>
                </div>
              ) : (
                /* Normal row */
                <div className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[rgb(var(--surface-soft))]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {budget.category?.icon && (
                        <span className="text-base leading-none">{budget.category.icon}</span>
                      )}
                      <span className="text-sm font-medium text-[rgb(var(--foreground))]">
                        {budget.category ? budget.category.name : t("budget.allCategories")}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                      {budget.currency}{" "}
                      {Number(budget.amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  {deleteConfirmId === budget.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[rgb(var(--muted))]">
                        {t("budget.deleteConfirm")}
                      </span>
                      <button
                        onClick={() => deleteBudget(budget.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))] transition hover:opacity-80"
                      >
                        <CheckIcon size={11} weight="bold" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
                      >
                        <XIcon size={11} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => {
                          setEditingId(budget.id);
                          setEditAmount(budget.amount);
                          setDeleteConfirmId(null);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
                        title={t("common.edit")}
                      >
                        <PencilIcon size={13} weight="bold" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirmId((prev) => (prev === budget.id ? null : budget.id));
                          setEditingId(null);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
                        title={t("common.delete")}
                      >
                        <TrashIcon size={13} weight="bold" />
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
