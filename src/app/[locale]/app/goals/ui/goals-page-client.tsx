"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  CheckCircleIcon,
  PlusIcon,
  TargetIcon,
  TrashIcon,
  XIcon
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";

type Goal = {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  deadline?: string | null;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
};

export function GoalsPageClient() {
  const { t } = useI18n();
  const { workspace } = useLuca();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", targetAmount: "", deadline: "" });

  function loadGoals() {
    if (!workspace) return;
    setLoading(true);
    apiFetch<{ goals: Goal[] }>(`/api/goals?workspaceId=${workspace.id}`)
      .then((r) => setGoals(r.goals))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadGoals();
  }, [workspace]);

  async function createGoal() {
    if (!workspace || !form.name || !form.targetAmount) return;
    setSaving(true);
    try {
      const goal = await apiFetch<{ goal: Goal }>("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: form.name,
          targetAmount: Number(form.targetAmount),
          currency: workspace.baseCurrency,
          deadline: form.deadline || null
        })
      });
      setGoals((prev) => [...prev, goal.goal]);
      setForm({ name: "", targetAmount: "", deadline: "" });
      setShowForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(goal: Goal) {
    const newStatus = goal.status === "COMPLETED" ? "ACTIVE" : "COMPLETED";
    try {
      const updated = await apiFetch<{ goal: Goal }>(`/api/goals/${goal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? updated.goal : g)));
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteGoal(id: string) {
    try {
      await apiFetch(`/api/goals/${id}`, { method: "DELETE" });
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const active = goals.filter((g) => g.status === "ACTIVE");
  const completed = goals.filter((g) => g.status === "COMPLETED");

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("goals.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("goals.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--foreground))] px-3 py-2 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 active:scale-[0.97]"
        >
          <PlusIcon size={14} weight="bold" />
          {t("goals.add")}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">{t("goals.add")}</span>
            <button
              onClick={() => setShowForm(false)}
              className="flex h-6 w-6 items-center justify-center rounded text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]"
            >
              <XIcon size={14} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[rgb(var(--muted))]">
                {t("goals.goalName")}
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("goals.goalNamePlaceholder")}
                className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-2 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-1 focus:ring-[rgb(var(--accent)/0.2)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[rgb(var(--muted))]">
                  {t("goals.target")} ({workspace?.baseCurrency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.targetAmount}
                  onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                  placeholder="1000"
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-2 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-1 focus:ring-[rgb(var(--accent)/0.2)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[rgb(var(--muted))]">
                  {t("goals.deadline")}
                </label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-2 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-1 focus:ring-[rgb(var(--accent)/0.2)]"
                />
              </div>
            </div>
            <button
              onClick={createGoal}
              disabled={saving || !form.name || !form.targetAmount}
              className="w-full rounded-lg bg-[rgb(var(--foreground))] py-2 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
            >
              {saving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
            />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-16 text-center">
          <TargetIcon size={32} className="mb-3 opacity-20" />
          <p className="text-sm text-[rgb(var(--muted))]">{t("goals.empty")}</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onToggle={() => toggleComplete(goal)}
                  onDelete={() => deleteGoal(goal.id)}
                  savedLabel={t("goals.saved")}
                  targetLabel={t("goals.target")}
                  noDeadlineLabel={t("goals.noDeadline")}
                />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-widest text-[rgb(var(--muted))]">
                {t("goals.completed")}
              </div>
              <div className="space-y-2">
                {completed.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onToggle={() => toggleComplete(goal)}
                    onDelete={() => deleteGoal(goal.id)}
                    savedLabel={t("goals.saved")}
                    targetLabel={t("goals.target")}
                    noDeadlineLabel={t("goals.noDeadline")}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onToggle,
  onDelete,
  savedLabel,
  targetLabel,
  noDeadlineLabel
}: {
  goal: Goal;
  onToggle: () => void;
  onDelete: () => void;
  savedLabel: string;
  targetLabel: string;
  noDeadlineLabel: string;
}) {
  const target = Number(goal.targetAmount);
  const current = Number(goal.currentAmount);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const isComplete = goal.status === "COMPLETED";

  return (
    <div
      className={[
        "group rounded-xl border bg-[rgb(var(--surface))] p-4 transition-opacity",
        isComplete
          ? "border-[rgb(var(--positive-dim))] opacity-70"
          : "border-[rgb(var(--border))]"
      ].join(" ")}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={[
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
              isComplete
                ? "border-[rgb(var(--positive))] bg-[rgb(var(--positive))] text-white"
                : "border-[rgb(var(--border))] hover:border-[rgb(var(--positive))]"
            ].join(" ")}
          >
            {isComplete && <CheckCircleIcon size={14} weight="fill" />}
          </button>
          <span
            className={[
              "text-sm font-medium",
              isComplete ? "line-through text-[rgb(var(--muted))]" : ""
            ].join(" ")}
          >
            {goal.name}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[rgb(var(--muted))] opacity-0 transition-all hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))] group-hover:opacity-100"
        >
          <TrashIcon size={13} weight="bold" />
        </button>
      </div>

      {/* Progress */}
      <div className="mb-2">
        <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
          <div
            className={[
              "h-full rounded-full transition-all duration-500",
              isComplete ? "bg-[rgb(var(--positive))]" : "bg-[rgb(var(--accent))]"
            ].join(" ")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[rgb(var(--muted))]">
        <span>
          {savedLabel}: {goal.currency} {Number(goal.currentAmount).toLocaleString(undefined, { minimumFractionDigits: 0 })}
        </span>
        <span>
          {targetLabel}: {goal.currency} {Number(goal.targetAmount).toLocaleString(undefined, { minimumFractionDigits: 0 })} · {pct}%
        </span>
      </div>

      {goal.deadline && (
        <div className="mt-1.5 text-xs text-[rgb(var(--muted))]">
          {new Date(goal.deadline).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
          })}
        </div>
      )}
    </div>
  );
}
