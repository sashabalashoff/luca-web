"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { useEffect, useState } from "react";

type Summary = {
  period: { start: string; end: string };
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  categoryBreakdown: Array<{ name: string; amount: number }>;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ReportsPageClient() {
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

  const monthLabel = summary?.period?.start
    ? new Date(summary.period.start).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long"
      })
    : new Date().toLocaleDateString(undefined, { year: "numeric", month: "long" });

  const maxCategory = Math.max(...(summary?.categoryBreakdown ?? []).map((c) => c.amount), 1);

  return (
    <div className="max-w-2xl space-y-5">
      {/* Period header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("reports.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{monthLabel}</p>
        </div>
      </div>

      {/* Income vs Expenses comparison */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
          <span className="text-sm font-medium">{t("reports.overview")}</span>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-[rgb(var(--surface-soft))]" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Income bar */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--positive))] font-medium">{t("reports.income")}</span>
                  <span className="font-semibold tabular-nums text-[rgb(var(--positive))]">
                    + {currency} {fmt(summary?.income ?? 0)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
                  <div
                    className="h-full rounded-full bg-[rgb(var(--positive))] opacity-80 transition-all duration-500"
                    style={{
                      width: `${summary && summary.income > 0
                        ? Math.min(100, Math.round((summary.income / Math.max(summary.income, summary.expenses)) * 100))
                        : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Expenses bar */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--negative))] font-medium">{t("reports.expenses")}</span>
                  <span className="font-semibold tabular-nums text-[rgb(var(--negative))]">
                    − {currency} {fmt(summary?.expenses ?? 0)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
                  <div
                    className="h-full rounded-full bg-[rgb(var(--negative))] opacity-80 transition-all duration-500"
                    style={{
                      width: `${summary && summary.expenses > 0
                        ? Math.min(100, Math.round((summary.expenses / Math.max(summary.income, summary.expenses)) * 100))
                        : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Net */}
              <div className="mt-2 flex items-center justify-between rounded-lg bg-[rgb(var(--surface-soft))] px-4 py-3">
                <span className="text-sm font-medium">{t("reports.net")}</span>
                <span
                  className={[
                    "text-sm font-semibold tabular-nums",
                    (summary?.net ?? 0) >= 0
                      ? "text-[rgb(var(--positive))]"
                      : "text-[rgb(var(--negative))]"
                  ].join(" ")}
                >
                  {(summary?.net ?? 0) >= 0 ? "+" : ""}
                  {currency} {fmt(summary?.net ?? 0)}
                </span>
              </div>

              {/* Savings rate */}
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-[rgb(var(--muted))]">{t("reports.savingsRate")}</span>
                <span className="text-sm font-semibold tabular-nums text-[rgb(var(--accent))]">
                  {(summary?.savingsRate ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category table */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
          <span className="text-sm font-medium">{t("reports.byCategory")}</span>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse bg-[rgb(var(--surface-soft))]"
              />
            ))}
          </div>
        ) : !summary?.categoryBreakdown?.length ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-sm text-[rgb(var(--muted))]">{t("reports.noData")}</p>
          </div>
        ) : (
          <div>
            {summary.categoryBreakdown.map((item, idx) => {
              const pct = Math.round((item.amount / maxCategory) * 100);
              const share = Math.round((item.amount / (summary.expenses || 1)) * 100);
              const isLast = idx === summary.categoryBreakdown.length - 1;

              return (
                <div
                  key={item.name}
                  className={[
                    "flex items-center gap-4 px-5 py-3",
                    !isLast ? "border-b border-[rgb(var(--border-soft))]" : ""
                  ].join(" ")}
                >
                  <div className="w-6 text-right text-xs font-medium text-[rgb(var(--muted))]">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-xs text-[rgb(var(--muted))]">{share}%</span>
                        <span className="font-semibold text-[rgb(var(--negative))]">
                          {currency} {fmt(item.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
                      <div
                        className="h-full rounded-full bg-[rgb(var(--negative))] opacity-60 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
