"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  CheckIcon,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("goals.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("goals.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.97]"
        >
          <PlusIcon size={14} weight="bold" />
          {t("goals.add")}
        </button>
      </div>

      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border-soft))] px-5 py-4">
            <span className="text-sm font-semibold">{t("goals.add")}</span>
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
                {t("goals.goalName")}
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("goals.goalNamePlaceholder")}
                className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                  {t("goals.target")} ({workspace?.baseCurrency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.targetAmount}
                  onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                  placeholder="1000"
                  className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                  {t("goals.deadline")}
                </label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
                />
              </div>
            </div>
            <button
              onClick={createGoal}
              disabled={saving || !form.name || !form.targetAmount}
              className="h-10 w-full rounded-lg bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
            >
              {saving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
            />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-20 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--surface-soft))]">
            <TargetIcon size={22} className="text-[rgb(var(--muted))] opacity-50" />
          </div>
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
                />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <div className="mb-3 text-xs font-medium text-[rgb(var(--muted))]">
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
  targetLabel
}: {
  goal: Goal;
  onToggle: () => void;
  onDelete: () => void;
  savedLabel: string;
  targetLabel: string;
}) {
  const target = Number(goal.targetAmount);
  const current = Number(goal.currentAmount);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const isComplete = goal.status === "COMPLETED";

  return (
    <div
      className={[
        "group rounded-2xl border bg-[rgb(var(--surface))] p-5 transition",
        isComplete
          ? "border-[rgb(var(--positive)/0.2)] opacity-60"
          : "border-[rgb(var(--border))]"
      ].join(" ")}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onToggle}
            className={[
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              isComplete
                ? "border-[rgb(var(--positive))] bg-[rgb(var(--positive))] text-white"
                : "border-[rgb(var(--border))] hover:border-[rgb(var(--positive))]"
            ].join(" ")}
          >
            {isComplete && <CheckIcon size={10} weight="bold" />}
          </button>
          <span
            className={[
              "text-sm font-medium",
              isComplete ? "line-through text-[rgb(var(--muted))]" : "text-[rgb(var(--foreground))]"
            ].join(" ")}
          >
            {goal.name}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[rgb(var(--muted))] opacity-0 transition-all hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))] group-hover:opacity-100"
        >
          <TrashIcon size={12} weight="bold" />
        </button>
      </div>

      <div className="mb-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
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
          {savedLabel}: {goal.currency}{" "}
          {Number(goal.currentAmount).toLocaleString(undefined, { minimumFractionDigits: 0 })}
        </span>
        <span>
          {targetLabel}: {goal.currency}{" "}
          {Number(goal.targetAmount).toLocaleString(undefined, { minimumFractionDigits: 0 })} · {pct}%
        </span>
      </div>

      {goal.deadline && (
        <div className="mt-2 text-xs text-[rgb(var(--muted-soft))]">
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
