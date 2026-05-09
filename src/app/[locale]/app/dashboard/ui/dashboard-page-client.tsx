"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { Card } from "@/shared/ui/card";
import { ChartPieSlice } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";
import { useLucaBootstrap } from "../../hooks/use-luca-bootstrap";

type Summary = {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  categoryBreakdown: Array<{
    name: string;
    amount: number;
  }>;
};

export function DashboardPageClient() {
  const { t } = useI18n();
  const { workspace } = useLucaBootstrap();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!workspace) return;

    apiFetch<Summary>(`/api/reports/monthly-summary?workspaceId=${workspace.id}`)
      .then(setSummary)
      .catch(console.error);
  }, [workspace]);

  const stats = [
    [t("dashboard.income"), summary?.income ?? 0],
    [t("dashboard.expenses"), summary?.expenses ?? 0],
    [t("dashboard.net"), summary?.net ?? 0],
    [t("dashboard.savingsRate"), `${(summary?.savingsRate ?? 0).toFixed(1)}%`]
  ];

  return (
    <div>
      <div className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-xs text-[rgb(var(--muted))]">
          <ChartPieSlice size={14} weight="duotone" />
          {t("dashboard.subtitle")}
        </div>

        <h1 className="text-4xl font-semibold tracking-[-0.055em]">
          {t("dashboard.title")}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label.toString()} className="p-5">
            <div className="text-sm text-[rgb(var(--muted))]">{label}</div>
            <div className="mt-4 text-3xl font-semibold tracking-[-0.055em]">
              {typeof value === "number" ? value.toFixed(2) : value}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-5 p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold tracking-[-0.04em]">
              {t("dashboard.topCategories")}
            </div>
            <div className="mt-1 text-sm text-[rgb(var(--muted))]">
              Expense breakdown
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {(summary?.categoryBreakdown ?? []).map((item) => {
            const width = Math.min(
              100,
              (item.amount / Math.max(summary?.expenses ?? 1, 1)) * 100
            );

            return (
              <div key={item.name}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-[rgb(var(--muted))]">
                    {item.amount.toFixed(2)}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
                  <div
                    className="h-full rounded-full bg-[rgb(var(--foreground))]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}

          {!summary?.categoryBreakdown?.length && (
            <div className="py-6 text-sm text-[rgb(var(--muted))]">
              No expense data yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}