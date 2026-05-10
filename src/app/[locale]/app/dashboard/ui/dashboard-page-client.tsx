"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";

type Summary = {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  categoryBreakdown: Array<{ name: string; amount: number }>;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DashboardPageClient() {
  const { t } = useI18n();
  const { workspace } = useLuca();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace) return;
    setLoading(true);
    apiFetch<Summary>(`/api/reports/monthly-summary?workspaceId=${workspace.id}`)
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspace]);

  const currency = workspace?.baseCurrency ?? "USD";
  const maxCategory = Math.max(...(summary?.categoryBreakdown ?? []).map((c) => c.amount), 1);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.income")}
          value={loading ? null : `${currency} ${fmt(summary?.income ?? 0)}`}
          trend="up"
          color="positive"
        />
        <StatCard
          label={t("dashboard.expenses")}
          value={loading ? null : `${currency} ${fmt(summary?.expenses ?? 0)}`}
          trend="down"
          color="negative"
        />
        <StatCard
          label={t("dashboard.net")}
          value={loading ? null : `${currency} ${fmt(summary?.net ?? 0)}`}
          color={summary && summary.net >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label={t("dashboard.savingsRate")}
          value={loading ? null : `${(summary?.savingsRate ?? 0).toFixed(1)}%`}
          color="accent"
        />
      </div>

      {/* Category breakdown */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
          <span className="text-sm font-medium">{t("dashboard.topCategories")}</span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-4 w-32 animate-pulse rounded bg-[rgb(var(--surface-soft))]" />
                  <div className="h-2 animate-pulse rounded-full bg-[rgb(var(--surface-soft))]" />
                </div>
              ))}
            </div>
          ) : !summary?.categoryBreakdown?.length ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="mb-2 text-3xl opacity-20">📊</div>
              <p className="text-sm text-[rgb(var(--muted))]">{t("dashboard.noData")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {summary.categoryBreakdown.map((item) => {
                const pct = Math.round((item.amount / maxCategory) * 100);
                const totalExpenses = summary.expenses || 1;
                const share = Math.round((item.amount / totalExpenses) * 100);

                return (
                  <div key={item.name}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-xs text-[rgb(var(--muted))]">{share}%</span>
                        <span className="font-medium text-[rgb(var(--negative))]">
                          {currency} {fmt(item.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
                      <div
                        className="h-full rounded-full bg-[rgb(var(--negative))] opacity-70 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type StatColor = "positive" | "negative" | "accent" | "default";

function StatCard({
  label,
  value,
  trend,
  color = "default"
}: {
  label: string;
  value: string | null;
  trend?: "up" | "down";
  color?: StatColor;
}) {
  const valueColor = {
    positive: "text-[rgb(var(--positive))]",
    negative: "text-[rgb(var(--negative))]",
    accent: "text-[rgb(var(--accent))]",
    default: "text-[rgb(var(--foreground))]"
  }[color];

  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-[rgb(var(--muted))]">
          {label}
        </span>
        {trend === "up" && (
          <ArrowUpRightIcon size={13} className="text-[rgb(var(--positive))]" />
        )}
        {trend === "down" && (
          <ArrowDownRightIcon size={13} className="text-[rgb(var(--negative))]" />
        )}
      </div>
      {value === null ? (
        <div className="h-7 w-24 animate-pulse rounded bg-[rgb(var(--surface-soft))]" />
      ) : (
        <div className={["text-xl font-semibold tracking-tight tabular-nums", valueColor].join(" ")}>
          {value}
        </div>
      )}
    </div>
  );
}
