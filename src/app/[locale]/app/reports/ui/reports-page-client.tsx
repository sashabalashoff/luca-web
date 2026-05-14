"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DownloadSimpleIcon,
  TrendUpIcon,
  TrendDownIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import useSWR from "swr";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Summary = {
  period: { start: string; end: string };
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  categoryBreakdown: Array<{ name: string; amount: number; type?: string }>;
};

type MonthPoint = {
  label: string;
  income: number;
  expenses: number;
};

function getMonthName(month: number, locale: string): string {
  return new Date(2024, month - 1, 1).toLocaleString(
    locale === "ru" ? "ru-RU" : "en-US",
    { month: "long" }
  );
}

function getDateRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

function getPrevMonth(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 2, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toFixed(0);
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

async function fetchTrendMonths(
  workspaceId: string,
  year: number,
  month: number,
  locale: string
): Promise<MonthPoint[]> {
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(year, month - 1 - (5 - i), 1));
      const { dateFrom, dateTo } = getDateRange(d.getUTCFullYear(), d.getUTCMonth() + 1);
      const label = d.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", { month: "short" });
      return apiFetch<Summary>(
        `/api/reports/monthly-summary?workspaceId=${workspaceId}&dateFrom=${dateFrom}&dateTo=${dateTo}`
      ).then((data) => ({ label, income: data.income, expenses: data.expenses }));
    })
  );
  return results.flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
}

/* ── Stat card ───────────────────────────────────────── */
function StatCard({
  label,
  value,
  change,
  positive,
  currency,
  accent,
}: {
  label: string;
  value: number;
  change: number | null;
  positive: boolean;
  currency: string;
  accent?: "green" | "red" | "blue";
}) {
  const colors = {
    green: "text-[rgb(var(--positive))]",
    red: "text-[rgb(var(--negative))]",
    blue: "text-[rgb(var(--accent))]",
  };
  const valueClass = accent ? colors[accent] : "text-[rgb(var(--foreground))]";

  return (
    <div className="luca-panel p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">{label}</div>
      <div className={["text-xl font-bold tabular-nums", valueClass].join(" ")}>
        {fmt(value, currency)}
      </div>
      {change !== null && (
        <div className={["mt-1.5 flex items-center gap-1 text-xs font-medium",
          positive ? "text-[rgb(var(--positive))]" : "text-[rgb(var(--negative))]",
        ].join(" ")}>
          {positive
            ? <TrendUpIcon size={12} weight="bold" />
            : <TrendDownIcon size={12} weight="bold" />}
          {Math.abs(change).toFixed(1)}% vs prev month
        </div>
      )}
    </div>
  );
}

/* ── Category breakdown row ─────────────────────────── */
function CategoryRow({
  item,
  max,
  total,
  currency,
  rank,
  isExpense,
}: {
  item: { name: string; amount: number };
  max: number;
  total: number;
  currency: string;
  rank: number;
  isExpense: boolean;
}) {
  const pct = Math.round((item.amount / (max || 1)) * 100);
  const share = total > 0 ? Math.round((item.amount / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="w-4 shrink-0 text-right text-xs tabular-nums text-[rgb(var(--muted-soft))]">{rank}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="truncate font-medium">{item.name}</span>
          <div className="ml-3 flex shrink-0 items-center gap-2.5 tabular-nums">
            <span className="text-xs text-[rgb(var(--muted))]">{share}%</span>
            <span className={["font-semibold", isExpense ? "text-[rgb(var(--negative))]" : "text-[rgb(var(--positive))]"].join(" ")}>
              {fmt(item.amount, currency)}
            </span>
          </div>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
          <div
            className={["h-full rounded-full transition-all duration-700", isExpense ? "bg-[rgb(var(--negative))]" : "bg-[rgb(var(--positive))]"].join(" ")}
            style={{ width: `${pct}%`, opacity: Math.max(0.35, 1 - rank * 0.08) }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────── */
export function ReportsPageClient() {
  const { t, locale } = useI18n();
  const { workspace } = useLuca();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [csvLoading, setCsvLoading] = useState(false);

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const currency = workspace?.baseCurrency ?? "USD";

  const { dateFrom, dateTo } = getDateRange(year, month);
  const prev = getPrevMonth(year, month);
  const { dateFrom: prevFrom, dateTo: prevTo } = getDateRange(prev.year, prev.month);

  const summaryKey = workspace
    ? `/api/reports/monthly-summary?workspaceId=${workspace.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`
    : null;
  const { data: summary, isLoading } = useSWR<Summary>(
    summaryKey,
    (url: string) => apiFetch<Summary>(url),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const prevKey = workspace
    ? `/api/reports/monthly-summary?workspaceId=${workspace.id}&dateFrom=${prevFrom}&dateTo=${prevTo}`
    : null;
  const { data: prevSummary } = useSWR<Summary>(
    prevKey,
    (url: string) => apiFetch<Summary>(url),
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  const trendKey = workspace ? `trend:${workspace.id}:${year}:${month}:${locale}` : null;
  const { data: trend = [], isLoading: trendLoading } = useSWR<MonthPoint[]>(
    trendKey,
    () => fetchTrendMonths(workspace!.id, year, month, locale),
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  async function handleCSVDownload() {
    if (!workspace) return;
    setCsvLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const url = `${apiBase}/api/reports/monthly-summary?workspaceId=${workspace.id}&dateFrom=${dateFrom}&dateTo=${dateTo}&format=csv`;
      const { createSupabaseBrowserClient } = await import("@/shared/lib/supabase/client");
      const { data: { session } } = await createSupabaseBrowserClient().auth.getSession();
      const res = await fetch(url, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("CSV export failed");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `luca-report-${year}-${String(month).padStart(2, "0")}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);
    } finally {
      setCsvLoading(false);
    }
  }

  const incomeChange = pctChange(summary?.income ?? 0, prevSummary?.income ?? 0);
  const expensesChange = pctChange(summary?.expenses ?? 0, prevSummary?.expenses ?? 0);
  const netChange = pctChange(summary?.net ?? 0, prevSummary?.net ?? 0);

  const maxCategory = Math.max(...(summary?.categoryBreakdown ?? []).map((c) => c.amount), 1);
  const totalExpenses = summary?.expenses ?? 0;
  const totalIncome = summary?.income ?? 0;

  const selectClass =
    "h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm text-[rgb(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))]";

  const skeletonClass = "animate-pulse rounded-lg bg-[rgb(var(--surface-soft))]";

  return (
    <div className="luca-page space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("reports.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("reports.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectClass}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{getMonthName(m, locale)}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectClass}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={handleCSVDownload}
            disabled={csvLoading || isLoading}
            title={t("reports.exportCSV")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))] disabled:opacity-40"
          >
            <DownloadSimpleIcon size={15} weight="bold" />
          </button>
        </div>
      </div>

      {/* Key metric cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${skeletonClass} h-24`} />
          ))
        ) : (
          <>
            <StatCard
              label={t("reports.income")}
              value={summary?.income ?? 0}
              change={incomeChange}
              positive={(incomeChange ?? 0) >= 0}
              currency={currency}
              accent="green"
            />
            <StatCard
              label={t("reports.expenses")}
              value={summary?.expenses ?? 0}
              change={expensesChange}
              positive={(expensesChange ?? 0) <= 0}
              currency={currency}
              accent="red"
            />
            <StatCard
              label={t("reports.net")}
              value={summary?.net ?? 0}
              change={netChange}
              positive={(netChange ?? 0) >= 0}
              currency={currency}
              accent={(summary?.net ?? 0) >= 0 ? "green" : "red"}
            />
            <div className="luca-panel p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                {t("reports.savingsRate")}
              </div>
              <div className="text-xl font-bold tabular-nums text-[rgb(var(--accent))]">
                {(summary?.savingsRate ?? 0).toFixed(1)}%
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
                <div
                  className="h-full rounded-full bg-[rgb(var(--accent))] transition-all duration-700"
                  style={{ width: `${Math.max(0, Math.min(100, summary?.savingsRate ?? 0))}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 6-month trend */}
      <div className="luca-panel overflow-hidden">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-4">
          <span className="text-sm font-semibold">{t("reports.trend")}</span>
          <span className="ml-2 text-xs text-[rgb(var(--muted))]">
            {locale === "ru" ? "6 месяцев" : "6 months"}
          </span>
        </div>
        <div className="p-5">
          {trendLoading ? (
            <div className={`${skeletonClass} h-44`} />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <BarChart data={trend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--border-soft))" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "rgb(var(--muted))" }}
                  tickFormatter={(v) => fmtShort(v)}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip
                  cursor={{ fill: "rgb(var(--surface-soft))" }}
                  formatter={(value, name) => [
                    fmt(Number(value ?? 0), currency),
                    name === "income" ? t("reports.income") : t("reports.expenses"),
                  ]}
                  contentStyle={{
                    background: "rgb(var(--surface))",
                    border: "1px solid rgb(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "rgb(var(--foreground))",
                  }}
                />
                <Legend
                  formatter={(v) => v === "income" ? t("reports.income") : t("reports.expenses")}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <Bar dataKey="income" fill="rgb(var(--positive))" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={24}>
                  {trend.map((_, i) => <Cell key={i} />)}
                </Bar>
                <Bar dataKey="expenses" fill="rgb(var(--negative))" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={24}>
                  {trend.map((_, i) => <Cell key={i} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Cashflow overview */}
      <div className="luca-panel overflow-hidden">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-4">
          <span className="text-sm font-semibold">{t("reports.overview")}</span>
        </div>
        <div className="divide-y divide-[rgb(var(--border-soft))]">
          {[
            {
              label: t("reports.income"),
              value: summary?.income ?? 0,
              prev: prevSummary?.income ?? 0,
              color: "bg-[rgb(var(--positive))]",
              textColor: "text-[rgb(var(--positive))]",
              sign: "+",
            },
            {
              label: t("reports.expenses"),
              value: summary?.expenses ?? 0,
              prev: prevSummary?.expenses ?? 0,
              color: "bg-[rgb(var(--negative))]",
              textColor: "text-[rgb(var(--negative))]",
              sign: "−",
            },
          ].map(({ label, value, prev: prevVal, color, textColor, sign }) => {
            const max = Math.max(summary?.income ?? 0, summary?.expenses ?? 0, 1);
            const change = pctChange(value, prevVal);
            return (
              <div key={label} className="px-5 py-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={["text-sm font-medium", textColor].join(" ")}>{label}</span>
                    {change !== null && (
                      <span className={[
                        "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        (sign === "+" ? change >= 0 : change <= 0)
                          ? "bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]"
                          : "bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))]",
                      ].join(" ")}>
                        {change >= 0 ? <ArrowUpIcon size={8} weight="bold" /> : <ArrowDownIcon size={8} weight="bold" />}
                        {Math.abs(change).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <span className={["text-sm font-bold tabular-nums", textColor].join(" ")}>
                    {sign}{fmt(value, currency)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
                  {isLoading ? (
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-[rgb(var(--surface-soft))]" />
                  ) : (
                    <div
                      className={["h-full rounded-full transition-all duration-700", color].join(" ")}
                      style={{ width: `${Math.min(100, Math.round((value / max) * 100))}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-column breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Expense breakdown */}
        <div className="luca-panel overflow-hidden">
          <div className="border-b border-[rgb(var(--border-soft))] px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t("reports.byCategory")}</span>
              <span className="rounded-full bg-[rgb(var(--negative-dim))] px-2 py-0.5 text-xs font-semibold text-[rgb(var(--negative))]">
                {locale === "ru" ? "Расходы" : "Expenses"}
              </span>
            </div>
          </div>
          {isLoading ? (
            <div className="space-y-px p-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className={`${skeletonClass} h-10`} />)}
            </div>
          ) : !summary?.categoryBreakdown?.length ? (
            <div className="flex flex-col items-center py-10 text-center">
              <p className="text-sm text-[rgb(var(--muted))]">{t("reports.noData")}</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgb(var(--border-soft))]">
              {summary.categoryBreakdown.slice(0, 8).map((item, idx) => (
                <CategoryRow
                  key={item.name}
                  item={item}
                  max={maxCategory}
                  total={totalExpenses}
                  currency={currency}
                  rank={idx + 1}
                  isExpense
                />
              ))}
            </div>
          )}
        </div>

        {/* Income vs expense summary + net */}
        <div className="space-y-4">
          {/* Net flow card */}
          <div className="luca-panel p-5">
            <div className="mb-4 text-sm font-semibold">{locale === "ru" ? "Итог месяца" : "Monthly summary"}</div>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className={`${skeletonClass} h-6`} />)}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">{t("reports.income")}</span>
                  <span className="font-semibold tabular-nums text-[rgb(var(--positive))]">
                    +{fmt(summary?.income ?? 0, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">{t("reports.expenses")}</span>
                  <span className="font-semibold tabular-nums text-[rgb(var(--negative))]">
                    −{fmt(summary?.expenses ?? 0, currency)}
                  </span>
                </div>
                <div className="my-1 h-px bg-[rgb(var(--border-soft))]" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{t("reports.net")}</span>
                  <span
                    className={[
                      "text-base font-bold tabular-nums",
                      (summary?.net ?? 0) >= 0 ? "text-[rgb(var(--positive))]" : "text-[rgb(var(--negative))]",
                    ].join(" ")}
                  >
                    {(summary?.net ?? 0) >= 0 ? "+" : ""}
                    {fmt(summary?.net ?? 0, currency)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Savings rate visual */}
          <div className="luca-panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">{t("reports.savingsRate")}</span>
              <span className="text-lg font-bold tabular-nums text-[rgb(var(--accent))]">
                {(summary?.savingsRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
              <div
                className="h-full rounded-full bg-[rgb(var(--accent))] transition-all duration-700"
                style={{ width: `${Math.max(0, Math.min(100, summary?.savingsRate ?? 0))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[rgb(var(--muted))]">
              {locale === "ru"
                ? "Доля доходов, которую вы сохранили"
                : "Share of income you kept"}
            </p>
          </div>

          {/* Prev month comparison */}
          {prevSummary && (
            <div className="luca-panel p-5">
              <div className="mb-3 text-sm font-semibold">
                {locale === "ru" ? "Прошлый месяц" : "Previous month"}
              </div>
              <div className="space-y-2">
                {[
                  { label: t("reports.income"), curr: summary?.income ?? 0, prev: prevSummary.income, positive: true },
                  { label: t("reports.expenses"), curr: summary?.expenses ?? 0, prev: prevSummary.expenses, positive: false },
                ].map(({ label, curr, prev: prevVal, positive }) => {
                  const change = pctChange(curr, prevVal);
                  const isGood = positive ? (change ?? 0) >= 0 : (change ?? 0) <= 0;
                  return (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-[rgb(var(--muted))]">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-[rgb(var(--muted-soft))]">
                          {fmt(prevVal, currency)}
                        </span>
                        {change !== null && (
                          <span className={[
                            "text-xs font-semibold",
                            isGood ? "text-[rgb(var(--positive))]" : "text-[rgb(var(--negative))]",
                          ].join(" ")}>
                            {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
