"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  WarningIcon,
  XIcon,
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
  spent?: number;
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

const COMMON_CURRENCIES = ["USD", "EUR", "RUB", "GBP", "AED", "CNY", "JPY", "TRY", "KZT", "UAH"];

const now = new Date();

function fmt(n: number, currency: string) {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

function ProgressBar({ pct, over }: { pct: number; over: boolean }) {
  const clamped = Math.min(pct, 100);
  const color = over
    ? "bg-[rgb(var(--negative))]"
    : pct >= 80
      ? "bg-amber-400"
      : "bg-[rgb(var(--positive))]";

  return (
    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--border))]">
      <div
        className={["h-full rounded-full transition-all", color].join(" ")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function getMonthName(month: number, locale: string): string {
  return new Date(2024, month - 1, 1).toLocaleString(
    locale === "ru" ? "ru-RU" : "en-US",
    { month: "long" }
  );
}

export function BudgetPageClient() {
  const { t, locale } = useI18n();
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
    currency: workspace?.baseCurrency ?? "USD",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
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
    if (workspace) setForm((f) => ({ ...f, currency: workspace.baseCurrency }));
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
          currency: form.currency,
        }),
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
        body: JSON.stringify({ amount: Number(editAmount) }),
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

  // Summary totals
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);
  const totalPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const currency = budgets[0]?.currency ?? workspace?.baseCurrency ?? "USD";

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("budget.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("budget.subtitle")}</p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setEditingId(null); }}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.97]"
        >
          {showForm ? <XIcon size={14} weight="bold" /> : <PlusIcon size={14} weight="bold" />}
          {t("budget.add")}
        </button>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[rgb(var(--muted))]">{t("budget.year")}</label>
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
          <label className="text-xs font-medium text-[rgb(var(--muted))]">{t("budget.month")}</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="h-8 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{getMonthName(m, locale)}</option>
            ))}
          </select>
        </div>
        {isCurrentMonth && (
          <span className="rounded-full bg-[rgb(var(--accent)/0.1)] px-2 py-0.5 text-xs font-medium text-[rgb(var(--accent))]">
            {t("budget.current")}
          </span>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
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

            <div className="grid grid-cols-[1fr_120px] gap-3">
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
                  {t("budget.currency")}
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
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

      {/* Summary card */}
      {!loading && budgets.length > 0 && (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-medium text-[rgb(var(--muted))]">
                {getMonthName(month, locale)} {year} — {t("budget.summaryTotal")}
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-[rgb(var(--foreground))]">
                {fmt(totalSpent, currency)}
              </div>
              <div className="mt-0.5 text-sm text-[rgb(var(--muted))]">
                {t("budget.of")} {fmt(totalBudget, currency)} {t("budget.ofBudgeted")}
              </div>
            </div>
            <div className="text-right">
              <div
                className={[
                  "text-xl font-bold tabular-nums",
                  totalPct > 100
                    ? "text-[rgb(var(--negative))]"
                    : totalPct >= 80
                      ? "text-amber-500"
                      : "text-[rgb(var(--positive))]",
                ].join(" ")}
              >
                {totalPct.toFixed(0)}%
              </div>
              <div className="text-xs text-[rgb(var(--muted))]">
                {totalBudget - totalSpent >= 0
                  ? `${fmt(totalBudget - totalSpent, currency)} ${t("budget.left")}`
                  : `${fmt(totalSpent - totalBudget, currency)} ${t("budget.over")}`}
              </div>
            </div>
          </div>
          <ProgressBar pct={totalPct} over={totalPct > 100} />
        </div>
      )}

      {/* Budget list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
            />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-20 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--surface-soft))]">
            <span className="text-2xl opacity-30">📊</span>
          </div>
          <p className="text-sm text-[rgb(var(--muted))]">{t("budget.empty")}</p>
          <p className="mt-1 text-xs text-[rgb(var(--muted-soft))]">
            {t("budget.emptyHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => {
            const limit = Number(budget.amount);
            const spent = budget.spent ?? 0;
            const remaining = limit - spent;
            const pct = limit > 0 ? (spent / limit) * 100 : 0;
            const over = pct > 100;
            const nearLimit = pct >= 80 && !over;

            return (
              <div
                key={budget.id}
                className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
              >
                {editingId === budget.id ? (
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1 text-sm font-medium text-[rgb(var(--foreground))]">
                      {budget.category
                        ? `${budget.category.icon ? budget.category.icon + " " : ""}${budget.category.name}`
                        : t("budget.allCategories")}
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
                  <div className="group px-5 py-4 transition-colors hover:bg-[rgb(var(--surface-soft)/0.5)]">
                    <div className="flex items-start gap-3">
                      {/* Category icon */}
                      {budget.category?.icon ? (
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--surface-soft))] text-lg">
                          {budget.category.icon}
                        </div>
                      ) : (
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--surface-soft))] text-sm text-[rgb(var(--muted))]">
                          📊
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-[rgb(var(--foreground))]">
                              {budget.category ? budget.category.name : t("budget.allCategories")}
                            </span>
                            {over && (
                              <WarningIcon
                                size={14}
                                weight="fill"
                                className="text-[rgb(var(--negative))]"
                              />
                            )}
                            {nearLimit && (
                              <WarningIcon
                                size={14}
                                weight="fill"
                                className="text-amber-500"
                              />
                            )}
                          </div>

                          {/* Actions (hover) */}
                          {deleteConfirmId === budget.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-[rgb(var(--muted))]">{t("budget.deleteConfirm")}</span>
                              <button
                                onClick={() => deleteBudget(budget.id)}
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))] transition hover:opacity-80"
                              >
                                <CheckIcon size={11} weight="bold" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]"
                              >
                                <XIcon size={11} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => { setEditingId(budget.id); setEditAmount(budget.amount); setDeleteConfirmId(null); }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
                              >
                                <PencilIcon size={13} weight="bold" />
                              </button>
                              <button
                                onClick={() => { setDeleteConfirmId((p) => (p === budget.id ? null : budget.id)); setEditingId(null); }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
                              >
                                <TrashIcon size={13} weight="bold" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Spend amounts row */}
                        <div className="mt-1 flex items-baseline gap-1.5 text-sm">
                          <span
                            className={[
                              "font-semibold tabular-nums",
                              over
                                ? "text-[rgb(var(--negative))]"
                                : nearLimit
                                  ? "text-amber-600"
                                  : "text-[rgb(var(--foreground))]",
                            ].join(" ")}
                          >
                            {fmt(spent, budget.currency)}
                          </span>
                          <span className="text-[rgb(var(--muted-soft))]">/</span>
                          <span className="text-[rgb(var(--muted))]">{fmt(limit, budget.currency)}</span>
                          <span className="ml-auto text-xs tabular-nums text-[rgb(var(--muted))]">
                            {remaining >= 0
                              ? `${fmt(remaining, budget.currency)} ${t("budget.left")}`
                              : `${fmt(-remaining, budget.currency)} ${t("budget.over")}`}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <ProgressBar pct={pct} over={over} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
