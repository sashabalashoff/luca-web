"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ArrowsHorizontalIcon,
  BankIcon,
  PiggyBankIcon,
} from "@phosphor-icons/react/dist/ssr";
import useSWR from "swr";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

type CardColor = "positive" | "negative" | "accent" | "default";

const iconBgClass: Record<CardColor, string> = {
  positive: "bg-[rgb(var(--positive-dim))]",
  negative: "bg-[rgb(var(--negative-dim))]",
  accent:   "bg-[rgb(var(--accent-dim))]",
  default:  "bg-[rgb(var(--surface-soft))]",
};
const iconColorClass: Record<CardColor, string> = {
  positive: "text-[rgb(var(--positive))]",
  negative: "text-[rgb(var(--negative))]",
  accent:   "text-[rgb(var(--accent))]",
  default:  "text-[rgb(var(--muted))]",
};
const valueColorClass: Record<CardColor, string> = {
  positive: "text-[rgb(var(--positive))]",
  negative: "text-[rgb(var(--negative))]",
  accent:   "text-[rgb(var(--accent))]",
  default:  "text-[rgb(var(--foreground))]",
};

export function DashboardPageClient() {
  const { t } = useI18n();
  const { workspace, accounts, transactionKey } = useLuca();

  const swrKey = workspace
    ? `/api/reports/monthly-summary?workspaceId=${workspace.id}&_k=${transactionKey}`
    : null;
  const { data: summary, error: swrError, isLoading: loading } = useSWR<Summary>(
    swrKey,
    (url: string) => apiFetch<Summary>(url),
    { revalidateOnFocus: true, dedupingInterval: 30_000 }
  );
  const loadError = !!swrError;

  const currency = workspace?.baseCurrency ?? "USD";
  const netColor: CardColor =
    summary && summary.net >= 0 ? "positive" : "negative";

  const totalBalance = accounts.reduce(
    (s, a) => s + Number(a.currentBalance),
    0
  );

  return (
    <div className="luca-page-wide space-y-6">
      {loadError && (
        <div className="rounded-xl border border-[rgb(var(--negative-dim))] bg-[rgb(var(--negative-dim))] px-4 py-3 text-sm text-[rgb(var(--negative))]">
          {t("common.errorLoading")}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">{t("dashboard.subtitle")}</p>
      </div>
      {/* ── Account balances ── */}
      {accounts.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[rgb(var(--muted))]">
            {t("dashboard.accounts")}
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--surface-soft))]">
                    <BankIcon size={14} className="text-[rgb(var(--muted))]" />
                  </div>
                  <span className="truncate text-xs font-medium text-[rgb(var(--muted))]">
                    {acc.name}
                  </span>
                </div>
                <div className="text-base font-semibold tabular-nums text-[rgb(var(--foreground))]">
                  {acc.currency} {fmt(Number(acc.currentBalance))}
                </div>
              </div>
            ))}
            {accounts.length > 1 && (
              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--accent-dim))] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent))]/15">
                    <ArrowsHorizontalIcon size={14} className="text-[rgb(var(--accent))]" />
                  </div>
                  <span className="truncate text-xs font-medium text-[rgb(var(--accent))]">
                    {t("dashboard.total")}
                  </span>
                </div>
                <div className="text-base font-semibold tabular-nums text-[rgb(var(--accent))]">
                  {currency} {fmt(totalBalance)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Monthly stat cards ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[rgb(var(--muted))]">
          {t("dashboard.subtitle")}
        </h2>
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
      </div>

      {/* ── Category breakdown ── */}
      <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-4">
          <span className="text-sm font-semibold">{t("dashboard.topCategories")}</span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-[rgb(var(--surface-soft))]" />
          ) : !summary?.categoryBreakdown?.length ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--surface-soft))]">
                <span className="text-2xl opacity-30">📊</span>
              </div>
              <p className="text-sm text-[rgb(var(--muted))]">{t("dashboard.noData")}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, summary.categoryBreakdown.length * 36)}>
              <BarChart
                data={summary.categoryBreakdown.map((item, idx) => ({
                  name: (item.icon ? item.icon + " " : "") + item.name,
                  amount: item.amount,
                  opacity: Math.max(0.45, 1 - idx * 0.08),
                }))}
                layout="vertical"
                margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "rgb(var(--muted))" }}
                  tickFormatter={(v) => `${currency} ${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 12, fill: "rgb(var(--foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgb(var(--surface-soft))" }}
                  formatter={(value) => [`${currency} ${fmt(Number(value ?? 0))}`, ""]}
                  contentStyle={{
                    background: "rgb(var(--surface))",
                    border: "1px solid rgb(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "rgb(var(--foreground))",
                  }}
                  itemStyle={{ color: "rgb(var(--foreground))" }}
                  labelStyle={{ display: "none" }}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {summary.categoryBreakdown.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill="rgb(var(--accent))"
                      fillOpacity={Math.max(0.45, 1 - idx * 0.08)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
  color = "default",
}: {
  label: string;
  value: string | null;
  icon: React.ElementType;
  color?: CardColor;
}) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5">
      <div
        className={[
          "mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl",
          iconBgClass[color],
        ].join(" ")}
      >
        <Icon size={17} weight="duotone" className={iconColorClass[color]} />
      </div>
      <div className="text-xs font-medium text-[rgb(var(--muted))]">{label}</div>
      {value === null ? (
        <div className="mt-1.5 h-6 w-20 animate-pulse rounded-md bg-[rgb(var(--surface-soft))]" />
      ) : (
        <div
          className={[
            "mt-1.5 text-xl font-semibold tracking-tight tabular-nums",
            valueColorClass[color],
          ].join(" ")}
        >
          {value}
        </div>
      )}
    </div>
  );
}
