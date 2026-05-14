"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";
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
  categoryBreakdown: Array<{ name: string; amount: number }>;
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

function getDateRange(year: number, month: number): { dateFrom: string; dateTo: string } {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0)); // last day of month
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchTrendMonths(workspaceId: string, year: number, month: number, locale: string): Promise<MonthPoint[]> {
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

export function ReportsPageClient() {
  const { t, locale } = useI18n();
  const { workspace } = useLuca();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [csvLoading, setCsvLoading] = useState(false);

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const { dateFrom, dateTo } = getDateRange(year, month);
  const summaryKey = workspace
    ? `/api/reports/monthly-summary?workspaceId=${workspace.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`
    : null;
  const { data: summary, isLoading: loading } = useSWR<Summary>(
    summaryKey,
    (url: string) => apiFetch<Summary>(url),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
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
      const { dateFrom, dateTo } = getDateRange(year, month);
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const url = `${apiBase}/api/reports/monthly-summary?workspaceId=${workspace.id}&dateFrom=${dateFrom}&dateTo=${dateTo}&format=csv`;

      const { createSupabaseBrowserClient } = await import("@/shared/lib/supabase/client");
      const { data: { session } } = await createSupabaseBrowserClient().auth.getSession();
      const token = session?.access_token;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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

  const currency = workspace?.baseCurrency ?? "USD";
  const maxCategory = Math.max(...(summary?.categoryBreakdown ?? []).map((c) => c.amount), 1);

  const selectClass =
    "rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 py-1.5 text-sm text-[rgb(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))]";

  return (
    <div className="luca-page space-y-5">
      {/* Header with period selector */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("reports.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("reports.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className={selectClass}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{getMonthName(m, locale)}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={selectClass}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={handleCSVDownload}
            disabled={csvLoading || loading}
            title={t("reports.exportCSV")}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))] disabled:opacity-40"
          >
            <DownloadSimpleIcon size={15} weight="bold" />
          </button>
        </div>
      </div>

      {/* 6-month trend chart */}
      <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-4">
          <span className="text-sm font-semibold">{t("reports.trend")}</span>
        </div>
        <div className="p-5">
          {trendLoading ? (
            <div className="h-44 animate-pulse rounded-xl bg-[rgb(var(--surface-soft))]" />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <BarChart data={trend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--border-soft))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "rgb(var(--muted))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "rgb(var(--muted))" }}
                  tickFormatter={(v) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  cursor={{ fill: "rgb(var(--surface-soft))" }}
                  formatter={(value, name) => [
                    `${currency} ${fmt(Number(value ?? 0))}`,
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
                <Bar dataKey="income" fill="rgb(var(--positive))" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={28}>
                  {trend.map((_, i) => <Cell key={i} />)}
                </Bar>
                <Bar dataKey="expenses" fill="rgb(var(--negative))" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={28}>
                  {trend.map((_, i) => <Cell key={i} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Income vs Expenses */}
      <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-4">
          <span className="text-sm font-semibold">{t("reports.overview")}</span>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-[rgb(var(--surface-soft))]" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-[rgb(var(--positive))]">{t("reports.income")}</span>
                  <span className="font-semibold tabular-nums text-[rgb(var(--positive))]">
                    +{currency} {fmt(summary?.income ?? 0)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
                  <div
                    className="h-full rounded-full bg-[rgb(var(--positive))] transition-all duration-700"
                    style={{
                      width: `${summary && summary.income > 0
                        ? Math.min(100, Math.round((summary.income / Math.max(summary.income, summary.expenses)) * 100))
                        : 0}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-[rgb(var(--negative))]">{t("reports.expenses")}</span>
                  <span className="font-semibold tabular-nums text-[rgb(var(--negative))]">
                    −{currency} {fmt(summary?.expenses ?? 0)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
                  <div
                    className="h-full rounded-full bg-[rgb(var(--negative))] transition-all duration-700"
                    style={{
                      width: `${summary && summary.expenses > 0
                        ? Math.min(100, Math.round((summary.expenses / Math.max(summary.income, summary.expenses)) * 100))
                        : 0}%`
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[rgb(var(--surface-soft))] px-4 py-3">
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

              <div className="flex items-center justify-between">
                <span className="text-sm text-[rgb(var(--muted))]">{t("reports.savingsRate")}</span>
                <span className="text-sm font-semibold tabular-nums text-[rgb(var(--accent))]">
                  {(summary?.savingsRate ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-4">
          <span className="text-sm font-semibold">{t("reports.byCategory")}</span>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse bg-[rgb(var(--surface-soft))]" />
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
                    "flex items-center gap-4 px-5 py-3.5",
                    !isLast ? "border-b border-[rgb(var(--border-soft))]" : ""
                  ].join(" ")}
                >
                  <div className="w-5 text-right text-xs tabular-nums text-[rgb(var(--muted-soft))]">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
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
                        className="h-full rounded-full bg-[rgb(var(--accent))] transition-all duration-700"
                        style={{ width: `${pct}%`, opacity: Math.max(0.4, 1 - idx * 0.1) }}
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
