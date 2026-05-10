"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ArrowsHorizontalIcon,
  PiggyBankIcon
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";

type Summary = {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  categoryBreakdown: Array<{ name: string; amount: number; icon?: string | null }>;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Stat card color config */
type CardColor = "positive" | "negative" | "accent" | "default";

const iconBgClass: Record<CardColor, string> = {
  positive: "bg-[rgb(var(--positive-dim))]",
  negative: "bg-[rgb(var(--negative-dim))]",
  accent:   "bg-[rgb(var(--accent-dim))]",
  default:  "bg-[rgb(var(--surface-soft))]"
};
const iconColorClass: Record<CardColor, string> = {
  positive: "text-[rgb(var(--positive))]",
  negative: "text-[rgb(var(--negative))]",
  accent:   "text-[rgb(var(--accent))]",
  default:  "text-[rgb(var(--muted))]"
};
const valueColorClass: Record<CardColor, string> = {
  positive: "text-[rgb(var(--positive))]",
  negative: "text-[rgb(var(--negative))]",
  accent:   "text-[rgb(var(--accent))]",
  default:  "text-[rgb(var(--foreground))]"
};

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

  const netColor: CardColor =
    summary && summary.net >= 0 ? "positive" : "negative";

  return (
    <div className="max-w-4xl space-y-6">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.income")}
          value={loading ? null : `${currency} ${fmt(summary?.income ?? 0)}`}
          icon={ArrowUpRightIcon}
          color="positive"
        />
        <StatCard
          label={t("dashboard.expenses")}
          value={loading ? null : `${currency} ${fmt(summary?.expenses ?? 0)}`}
          icon={ArrowDownRightIcon}
          color="negative"
        />
        <StatCard
          label={t("dashboard.net")}
          value={loading ? null : `${currency} ${fmt(summary?.net ?? 0)}`}
          icon={ArrowsHorizontalIcon}
          color={netColor}
        />
        <StatCard
          label={t("dashboard.savingsRate")}
          value={loading ? null : `${(summary?.savingsRate ?? 0).toFixed(1)}%`}
          icon={PiggyBankIcon}
          color="accent"
        />
      </div>

      {/* ── Category breakdown ── */}
      <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-4">
          <span className="text-sm font-semibold">{t("dashboard.topCategories")}</span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="space-y-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded-md bg-[rgb(var(--surface-soft))]" />
                  <div className="h-2 animate-pulse rounded-full bg-[rgb(var(--surface-soft))]" />
                </div>
              ))}
            </div>
          ) : !summary?.categoryBreakdown?.length ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--surface-soft))]">
                <span className="text-2xl opacity-30">📊</span>
              </div>
              <p className="text-sm text-[rgb(var(--muted))]">{t("dashboard.noData")}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {summary.categoryBreakdown.map((item, idx) => {
                const pct = Math.round((item.amount / maxCategory) * 100);
                const totalExpenses = summary.expenses || 1;
                const share = Math.round((item.amount / totalExpenses) * 100);

                return (
                  <div key={item.name}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.icon ? (
                          <span className="text-base leading-none">{item.icon}</span>
                        ) : (
                          <div
                            className="h-2 w-2 rounded-full bg-[rgb(var(--accent))]"
                            style={{ opacity: Math.max(0.3, 1 - idx * 0.12) }}
                          />
                        )}
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-xs text-[rgb(var(--muted))]">{share}%</span>
                        <span className="text-sm font-semibold text-[rgb(var(--negative))]">
                          {currency} {fmt(item.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: `rgb(var(--accent))`,
                          opacity: Math.max(0.35, 1 - idx * 0.1)
                        }}
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

function StatCard({
  label,
  value,
  icon: Icon,
  color = "default"
}: {
  label: string;
  value: string | null;
  icon: React.ElementType;
  color?: CardColor;
}) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5">
      <div className={["mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl", iconBgClass[color]].join(" ")}>
        <Icon size={17} weight="duotone" className={iconColorClass[color]} />
      </div>
      <div className="text-xs font-medium text-[rgb(var(--muted))]">{label}</div>
      {value === null ? (
        <div className="mt-1.5 h-6 w-20 animate-pulse rounded-md bg-[rgb(var(--surface-soft))]" />
      ) : (
        <div className={["mt-1.5 text-xl font-semibold tracking-tight tabular-nums", valueColorClass[color]].join(" ")}>
          {value}
        </div>
      )}
    </div>
  );
}
