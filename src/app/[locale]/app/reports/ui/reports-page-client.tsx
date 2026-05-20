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
  ChartBarIcon,
  ArrowsDownUpIcon,
  ArrowFatLinesDownIcon,
  ArrowFatLinesUpIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type CatItem = { name: string; amount: number; icon?: string | null };

type Summary = {
  period: { start: string; end: string };
  currency: string;
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  categoryBreakdown: CatItem[];
  incomeBreakdown?: CatItem[];
};

type TrendPoint = { month: string; income: number; expenses: number; net: number };
type TrendData = { points: TrendPoint[]; currency: string };

type Merchant = { merchant: string; amount: number; count: number };
type MerchantsData = { merchants: Merchant[] };

type PeriodId = "this_month" | "last_month" | "last_3m" | "last_6m" | "this_year" | "last_year";
type Tab = "overview" | "cashflow" | "expenses" | "income";

// ─── Period helpers ───────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPeriodRange(id: PeriodId): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed

  switch (id) {
    case "this_month":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y, m, 1))),
        dateTo: isoDate(new Date(Date.UTC(y, m + 1, 0))),
      };
    case "last_month":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y, m - 1, 1))),
        dateTo: isoDate(new Date(Date.UTC(y, m, 0))),
      };
    case "last_3m":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y, m - 3, 1))),
        dateTo: isoDate(new Date(Date.UTC(y, m, 0))),
      };
    case "last_6m":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y, m - 6, 1))),
        dateTo: isoDate(new Date(Date.UTC(y, m, 0))),
      };
    case "this_year":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y, 0, 1))),
        dateTo: isoDate(new Date(Date.UTC(y, m + 1, 0))),
      };
    case "last_year":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y - 1, 0, 1))),
        dateTo: isoDate(new Date(Date.UTC(y - 1, 11, 31))),
      };
  }
}

function getPrevPeriodRange(id: PeriodId): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  switch (id) {
    case "this_month":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y, m - 1, 1))),
        dateTo: isoDate(new Date(Date.UTC(y, m, 0))),
      };
    case "last_month":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y, m - 2, 1))),
        dateTo: isoDate(new Date(Date.UTC(y, m - 1, 0))),
      };
    case "last_3m":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y, m - 6, 1))),
        dateTo: isoDate(new Date(Date.UTC(y, m - 3, 0))),
      };
    case "last_6m":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y, m - 12, 1))),
        dateTo: isoDate(new Date(Date.UTC(y, m - 6, 0))),
      };
    case "this_year":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y - 1, 0, 1))),
        dateTo: isoDate(new Date(Date.UTC(y - 1, 11, 31))),
      };
    case "last_year":
      return {
        dateFrom: isoDate(new Date(Date.UTC(y - 2, 0, 1))),
        dateTo: isoDate(new Date(Date.UTC(y - 2, 11, 31))),
      };
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return n.toFixed(0);
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

function formatMonth(key: string, locale: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", { month: "short", year: "2-digit" });
}

// ─── Shared chart styles ──────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  background: "rgb(var(--surface))",
  border: "1px solid rgb(var(--border))",
  borderRadius: 10,
  fontSize: 12,
  color: "rgb(var(--foreground))",
};

const SKELETON = "animate-pulse rounded-lg bg-[rgb(var(--surface-soft))]";

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  change,
  positiveChange,
  currency,
  accent,
  suffix,
}: {
  label: string;
  value: number;
  change: number | null;
  positiveChange: boolean;
  currency: string;
  accent?: "green" | "red" | "blue" | "auto";
  suffix?: string;
}) {
  const autoAccent = accent === "auto" ? (value >= 0 ? "green" : "red") : accent;
  const colorMap = {
    green: "text-[rgb(var(--positive))]",
    red: "text-[rgb(var(--negative))]",
    blue: "text-[rgb(var(--accent))]",
  };
  const valueClass = autoAccent ? colorMap[autoAccent] : "text-[rgb(var(--foreground))]";

  return (
    <div className="luca-panel p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
        {label}
      </div>
      <div className={["text-xl font-bold tabular-nums truncate", valueClass].join(" ")}>
        {suffix ? `${value.toFixed(1)}${suffix}` : fmt(value, currency)}
      </div>
      {change !== null && (
        <div
          className={[
            "mt-1.5 flex items-center gap-1 text-xs font-medium",
            positiveChange ? "text-[rgb(var(--positive))]" : "text-[rgb(var(--negative))]",
          ].join(" ")}
        >
          {positiveChange ? (
            <TrendUpIcon size={12} weight="bold" />
          ) : (
            <TrendDownIcon size={12} weight="bold" />
          )}
          {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// ─── HBar: horizontal category bar row ───────────────────────────────────────

function HBar({
  item,
  total,
  currency,
  rank,
  color,
}: {
  item: CatItem;
  total: number;
  currency: string;
  rank: number;
  color: string;
}) {
  const share = total > 0 ? (item.amount / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="w-5 shrink-0 text-right text-xs tabular-nums text-[rgb(var(--muted-soft))]">
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="truncate font-medium">{item.name}</span>
          <div className="ml-3 flex shrink-0 items-center gap-2 tabular-nums">
            <span className="text-xs text-[rgb(var(--muted))]">{share.toFixed(1)}%</span>
            <span className={["font-semibold", color].join(" ")}>{fmt(item.amount, currency)}</span>
          </div>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
          <div
            className={["h-full rounded-full transition-all duration-500", color.replace("text-", "bg-")].join(" ")}
            style={{ width: `${Math.max(2, share)}%`, opacity: Math.max(0.3, 1 - rank * 0.06) }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

const DONUT_COLORS = [
  "rgb(var(--accent))",
  "rgb(var(--positive))",
  "rgb(var(--negative))",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
];

function DonutChart({
  data,
  currency,
}: {
  data: CatItem[];
  currency: string;
}) {
  const top = data.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={top}
          dataKey="amount"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
        >
          {top.map((_, i) => (
            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(val) => [fmt(Number(val ?? 0), currency), ""]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(v: string) => (
            <span style={{ color: "rgb(var(--foreground))" }}>{v}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  summary,
  prevSummary,
  trend,
  isLoading,
  trendLoading,
  currency,
  locale,
  t,
}: {
  summary?: Summary;
  prevSummary?: Summary;
  trend?: TrendData;
  isLoading: boolean;
  trendLoading: boolean;
  currency: string;
  locale: string;
  t: (k: string) => string;
}) {
  const incomeChange = pctChange(summary?.income ?? 0, prevSummary?.income ?? 0);
  const expensesChange = pctChange(summary?.expenses ?? 0, prevSummary?.expenses ?? 0);
  const netChange = pctChange(summary?.net ?? 0, prevSummary?.net ?? 0);

  const trendPoints = useMemo(
    () =>
      (trend?.points ?? []).map((p) => ({
        ...p,
        label: formatMonth(p.month, locale),
      })),
    [trend, locale]
  );

  const topExpenses = (summary?.categoryBreakdown ?? []).slice(0, 5);
  const totalExpenses = summary?.expenses ?? 0;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${SKELETON} h-24`} />)
        ) : (
          <>
            <StatCard
              label={t("reports.income")}
              value={summary?.income ?? 0}
              change={incomeChange}
              positiveChange={(incomeChange ?? 0) >= 0}
              currency={currency}
              accent="green"
            />
            <StatCard
              label={t("reports.expenses")}
              value={summary?.expenses ?? 0}
              change={expensesChange}
              positiveChange={(expensesChange ?? 0) <= 0}
              currency={currency}
              accent="red"
            />
            <StatCard
              label={t("reports.net")}
              value={summary?.net ?? 0}
              change={netChange}
              positiveChange={(netChange ?? 0) >= 0}
              currency={currency}
              accent="auto"
            />
            <StatCard
              label={t("reports.savingsRate")}
              value={summary?.savingsRate ?? 0}
              change={null}
              positiveChange
              currency={currency}
              accent="blue"
              suffix="%"
            />
          </>
        )}
      </div>

      {/* Trend chart */}
      <div className="luca-panel overflow-hidden">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5 flex items-center justify-between">
          <span className="text-sm font-semibold">{t("reports.trend")}</span>
        </div>
        <div className="p-4">
          {trendLoading ? (
            <div className={`${SKELETON} h-44`} />
          ) : trendPoints.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-[rgb(var(--muted))]">
              {t("reports.noData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={trendPoints} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(var(--positive))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="rgb(var(--positive))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(var(--negative))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="rgb(var(--negative))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgb(var(--border-soft))" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} tickFormatter={fmtShort} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v, name) => [
                    fmt(Number(v ?? 0), currency),
                    name === "income" ? t("reports.income") : t("reports.expenses"),
                  ]}
                />
                <Legend formatter={(v) => v === "income" ? t("reports.income") : t("reports.expenses")} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Area type="monotone" dataKey="income" stroke="rgb(var(--positive))" strokeWidth={2} fill="url(#incomeGrad)" dot={false} />
                <Area type="monotone" dataKey="expenses" stroke="rgb(var(--negative))" strokeWidth={2} fill="url(#expenseGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Two-column: top expenses + monthly net */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top expense categories */}
        <div className="luca-panel overflow-hidden">
          <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm font-semibold">{t("reports.byCategory")}</span>
            <span className="rounded-full bg-[rgb(var(--negative-dim))] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--negative))]">
              {t("reports.tab_expenses")}
            </span>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className={`${SKELETON} h-9`} />)}
            </div>
          ) : topExpenses.length === 0 ? (
            <div className="flex h-36 items-center justify-center text-sm text-[rgb(var(--muted))]">
              {t("reports.noData")}
            </div>
          ) : (
            <div className="divide-y divide-[rgb(var(--border-soft))] py-1">
              {topExpenses.map((item, i) => (
                <HBar key={item.name} item={item} total={totalExpenses} currency={currency} rank={i + 1} color="text-[rgb(var(--negative))]" />
              ))}
            </div>
          )}
        </div>

        {/* Net summary card */}
        <div className="luca-panel p-5 space-y-4">
          <div className="text-sm font-semibold">
            {locale === "ru" ? "Итог периода" : "Period summary"}
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className={`${SKELETON} h-6`} />)}
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {[
                  { label: t("reports.income"), value: summary?.income ?? 0, color: "text-[rgb(var(--positive))]", sign: "+" },
                  { label: t("reports.expenses"), value: summary?.expenses ?? 0, color: "text-[rgb(var(--negative))]", sign: "−" },
                ].map(({ label, value, color, sign }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-[rgb(var(--muted))]">{label}</span>
                    <span className={["font-semibold tabular-nums", color].join(" ")}>
                      {sign}{fmt(value, currency)}
                    </span>
                  </div>
                ))}
                <div className="h-px bg-[rgb(var(--border-soft))]" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{t("reports.net")}</span>
                  <span className={["text-base font-bold tabular-nums", (summary?.net ?? 0) >= 0 ? "text-[rgb(var(--positive))]" : "text-[rgb(var(--negative))]"].join(" ")}>
                    {(summary?.net ?? 0) >= 0 ? "+" : ""}{fmt(summary?.net ?? 0, currency)}
                  </span>
                </div>
              </div>

              {/* Savings rate meter */}
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">{t("reports.savingsRate")}</span>
                  <span className="font-bold tabular-nums text-[rgb(var(--accent))]">
                    {(summary?.savingsRate ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-soft))]">
                  <div
                    className="h-full rounded-full bg-[rgb(var(--accent))] transition-all duration-700"
                    style={{ width: `${Math.max(0, Math.min(100, summary?.savingsRate ?? 0))}%` }}
                  />
                </div>
              </div>

              {/* Prev period compare */}
              {prevSummary && (
                <div className="border-t border-[rgb(var(--border-soft))] pt-3 space-y-1.5">
                  <div className="text-xs font-semibold text-[rgb(var(--muted))] mb-2">
                    {locale === "ru" ? "Прошлый период" : "Previous period"}
                  </div>
                  {[
                    { label: t("reports.income"), curr: summary?.income ?? 0, prev: prevSummary.income, good: (c: number) => c >= 0 },
                    { label: t("reports.expenses"), curr: summary?.expenses ?? 0, prev: prevSummary.expenses, good: (c: number) => c <= 0 },
                  ].map(({ label, curr, prev: prevVal, good }) => {
                    const change = pctChange(curr, prevVal);
                    return (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className="text-[rgb(var(--muted))]">{label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums text-[rgb(var(--muted-soft))]">{fmt(prevVal, currency)}</span>
                          {change !== null && (
                            <span className={["font-semibold", good(change) ? "text-[rgb(var(--positive))]" : "text-[rgb(var(--negative))]"].join(" ")}>
                              {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cash Flow tab ────────────────────────────────────────────────────────────

function CashFlowTab({
  trend,
  isLoading,
  currency,
  locale,
  t,
}: {
  trend?: TrendData;
  isLoading: boolean;
  currency: string;
  locale: string;
  t: (k: string) => string;
}) {
  const points = useMemo(
    () => (trend?.points ?? []).map((p) => ({ ...p, label: formatMonth(p.month, locale) })),
    [trend, locale]
  );

  return (
    <div className="space-y-4">
      {/* Composed chart */}
      <div className="luca-panel overflow-hidden">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
          <span className="text-sm font-semibold">{t("reports.tab_cashflow")}</span>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className={`${SKELETON} h-56`} />
          ) : points.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-[rgb(var(--muted))]">
              {t("reports.noData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={points} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--border-soft))" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} tickFormatter={fmtShort} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v, name) => [
                    fmt(Number(v ?? 0), currency),
                    name === "income" ? t("reports.income") : name === "expenses" ? t("reports.expenses") : t("reports.net"),
                  ]}
                />
                <Legend
                  formatter={(v) =>
                    v === "income" ? t("reports.income") : v === "expenses" ? t("reports.expenses") : t("reports.net")
                  }
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <ReferenceLine y={0} stroke="rgb(var(--border))" strokeDasharray="4 2" />
                <Bar dataKey="income" fill="rgb(var(--positive))" fillOpacity={0.7} radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="expenses" fill="rgb(var(--negative))" fillOpacity={0.7} radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Line type="monotone" dataKey="net" stroke="rgb(var(--accent))" strokeWidth={2} dot={{ r: 3, fill: "rgb(var(--accent))" }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly table */}
      <div className="luca-panel overflow-hidden">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
          <span className="text-sm font-semibold">{t("reports.monthly_breakdown")}</span>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => <div key={i} className={`${SKELETON} h-9`} />)}
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-[rgb(var(--muted))]">
            {t("reports.noData")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border-soft))]">
                  {[t("reports.month"), t("reports.income"), t("reports.expenses"), t("reports.net"), t("reports.savingsRate")].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-soft))]">
                {[...points].reverse().map((p) => {
                  const sr = p.income > 0 ? ((p.income - p.expenses) / p.income) * 100 : 0;
                  return (
                    <tr key={p.month} className="transition hover:bg-[rgb(var(--surface-soft))]">
                      <td className="px-5 py-3 font-medium">{p.label}</td>
                      <td className="px-5 py-3 tabular-nums text-[rgb(var(--positive))]">+{fmt(p.income, currency)}</td>
                      <td className="px-5 py-3 tabular-nums text-[rgb(var(--negative))]">−{fmt(p.expenses, currency)}</td>
                      <td className={["px-5 py-3 tabular-nums font-semibold", p.net >= 0 ? "text-[rgb(var(--positive))]" : "text-[rgb(var(--negative))]"].join(" ")}>
                        {p.net >= 0 ? "+" : ""}{fmt(p.net, currency)}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-[rgb(var(--accent))]">{sr.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Expenses tab ─────────────────────────────────────────────────────────────

function ExpensesTab({
  summary,
  merchants,
  isLoading,
  merchantsLoading,
  currency,
  t,
}: {
  summary?: Summary;
  merchants?: MerchantsData;
  isLoading: boolean;
  merchantsLoading: boolean;
  currency: string;
  t: (k: string) => string;
}) {
  const categories = summary?.categoryBreakdown ?? [];
  const total = summary?.expenses ?? 0;

  return (
    <div className="space-y-4">
      {/* Donut + category list */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="luca-panel overflow-hidden">
          <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
            <span className="text-sm font-semibold">{t("reports.byCategory")}</span>
          </div>
          <div className="p-2">
            {isLoading ? (
              <div className={`${SKELETON} h-52 m-2`} />
            ) : categories.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-sm text-[rgb(var(--muted))]">
                {t("reports.noData")}
              </div>
            ) : (
              <DonutChart data={categories} currency={currency} />
            )}
          </div>
        </div>

        <div className="luca-panel overflow-hidden">
          <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
            <span className="text-sm font-semibold">{t("reports.byCategory")}</span>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className={`${SKELETON} h-9`} />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex h-36 items-center justify-center text-sm text-[rgb(var(--muted))]">
              {t("reports.noData")}
            </div>
          ) : (
            <div className="divide-y divide-[rgb(var(--border-soft))] py-1">
              {categories.map((item, i) => (
                <HBar key={item.name} item={item} total={total} currency={currency} rank={i + 1} color="text-[rgb(var(--negative))]" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top merchants */}
      <div className="luca-panel overflow-hidden">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
          <span className="text-sm font-semibold">{t("reports.top_merchants")}</span>
        </div>
        {merchantsLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className={`${SKELETON} h-9`} />)}
          </div>
        ) : !merchants?.merchants.length ? (
          <div className="flex h-24 items-center justify-center text-sm text-[rgb(var(--muted))]">
            {t("reports.no_merchants")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border-soft))]">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">#</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                    {t("reports.top_merchants")}
                  </th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                    {t("reports.transactions_count")}
                  </th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                    {t("reports.expenses")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-soft))]">
                {merchants.merchants.map((m, i) => (
                  <tr key={m.merchant} className="transition hover:bg-[rgb(var(--surface-soft))]">
                    <td className="px-5 py-3 text-xs tabular-nums text-[rgb(var(--muted-soft))]">{i + 1}</td>
                    <td className="px-5 py-3 font-medium max-w-xs truncate">{m.merchant}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[rgb(var(--muted))]">{m.count}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold text-[rgb(var(--negative))]">
                      {fmt(m.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Income tab ───────────────────────────────────────────────────────────────

function IncomeTab({
  summary,
  trend,
  isLoading,
  trendLoading,
  currency,
  locale,
  t,
}: {
  summary?: Summary;
  trend?: TrendData;
  isLoading: boolean;
  trendLoading: boolean;
  currency: string;
  locale: string;
  t: (k: string) => string;
}) {
  const categories = summary?.incomeBreakdown ?? [];
  const total = summary?.income ?? 0;

  const trendPoints = useMemo(
    () => (trend?.points ?? []).map((p) => ({ ...p, label: formatMonth(p.month, locale) })),
    [trend, locale]
  );

  return (
    <div className="space-y-4">
      {/* Income by category */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="luca-panel overflow-hidden">
          <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
            <span className="text-sm font-semibold">{t("reports.income_sources")}</span>
          </div>
          <div className="p-2">
            {isLoading ? (
              <div className={`${SKELETON} h-52 m-2`} />
            ) : categories.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-sm text-[rgb(var(--muted))]">
                {t("reports.noData")}
              </div>
            ) : (
              <DonutChart data={categories} currency={currency} />
            )}
          </div>
        </div>

        <div className="luca-panel overflow-hidden">
          <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
            <span className="text-sm font-semibold">{t("reports.income_sources")}</span>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => <div key={i} className={`${SKELETON} h-9`} />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex h-36 items-center justify-center text-sm text-[rgb(var(--muted))]">
              {t("reports.noData")}
            </div>
          ) : (
            <div className="divide-y divide-[rgb(var(--border-soft))] py-1">
              {categories.map((item, i) => (
                <HBar key={item.name} item={item} total={total} currency={currency} rank={i + 1} color="text-[rgb(var(--positive))]" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Income trend bar chart */}
      <div className="luca-panel overflow-hidden">
        <div className="border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
          <span className="text-sm font-semibold">{t("reports.trend")}</span>
        </div>
        <div className="p-4">
          {trendLoading ? (
            <div className={`${SKELETON} h-44`} />
          ) : trendPoints.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-[rgb(var(--muted))]">
              {t("reports.noData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <BarChart data={trendPoints} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--border-soft))" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} tickFormatter={fmtShort} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [fmt(Number(v ?? 0), currency), t("reports.income")]}
                />
                <Bar dataKey="income" fill="rgb(var(--positive))" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReportsPageClient() {
  const { t, locale } = useI18n();
  const { workspace } = useLuca();
  const currency = workspace?.baseCurrency ?? "USD";

  const [period, setPeriod] = useState<PeriodId>("this_month");
  const [tab, setTab] = useState<Tab>("overview");
  const [csvLoading, setCsvLoading] = useState(false);

  const { dateFrom, dateTo } = useMemo(() => getPeriodRange(period), [period]);
  const { dateFrom: prevFrom, dateTo: prevTo } = useMemo(() => getPrevPeriodRange(period), [period]);

  const PERIODS: { id: PeriodId; label: string }[] = [
    { id: "this_month", label: t("reports.period_this_month") },
    { id: "last_month", label: t("reports.period_last_month") },
    { id: "last_3m", label: t("reports.period_last_3m") },
    { id: "last_6m", label: t("reports.period_last_6m") },
    { id: "this_year", label: t("reports.period_this_year") },
    { id: "last_year", label: t("reports.period_last_year") },
  ];

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: t("reports.tab_overview"), icon: <ChartBarIcon size={14} weight="bold" /> },
    { id: "cashflow", label: t("reports.tab_cashflow"), icon: <ArrowsDownUpIcon size={14} weight="bold" /> },
    { id: "expenses", label: t("reports.tab_expenses"), icon: <ArrowFatLinesDownIcon size={14} weight="bold" /> },
    { id: "income", label: t("reports.tab_income"), icon: <ArrowFatLinesUpIcon size={14} weight="bold" /> },
  ];

  // Summary for selected period
  const summaryKey = workspace
    ? `/api/reports/monthly-summary?workspaceId=${workspace.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`
    : null;
  const { data: summary, isLoading } = useSWR<Summary>(
    summaryKey,
    (url: string) => apiFetch<Summary>(url),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // Summary for previous comparable period
  const prevKey = workspace
    ? `/api/reports/monthly-summary?workspaceId=${workspace.id}&dateFrom=${prevFrom}&dateTo=${prevTo}`
    : null;
  const { data: prevSummary } = useSWR<Summary>(
    prevKey,
    (url: string) => apiFetch<Summary>(url),
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  // Trend points (monthly breakdown)
  const trendKey = workspace
    ? `/api/reports/trend?workspaceId=${workspace.id}&dateFrom=${dateFrom}&dateTo=${dateTo}`
    : null;
  const { data: trend, isLoading: trendLoading } = useSWR<TrendData>(
    trendKey,
    (url: string) => apiFetch<TrendData>(url),
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  // Top merchants (expenses tab)
  const merchantsKey = workspace
    ? `/api/reports/top-merchants?workspaceId=${workspace.id}&dateFrom=${dateFrom}&dateTo=${dateTo}&limit=15`
    : null;
  const { data: merchants, isLoading: merchantsLoading } = useSWR<MerchantsData>(
    merchantsKey,
    (url: string) => apiFetch<MerchantsData>(url),
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
      link.download = `luca-report-${dateFrom}-${dateTo}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);
    } finally {
      setCsvLoading(false);
    }
  }

  const selectClass =
    "h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm text-[rgb(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))]";

  return (
    <div className="luca-page space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("reports.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("reports.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodId)}
            className={selectClass}
          >
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
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

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] p-1">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={[
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
              tab === tabItem.id
                ? "bg-[rgb(var(--surface))] text-[rgb(var(--foreground))] shadow-sm"
                : "text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]",
            ].join(" ")}
          >
            {tabItem.icon}
            <span className="hidden sm:inline">{tabItem.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <OverviewTab
          summary={summary}
          prevSummary={prevSummary}
          trend={trend}
          isLoading={isLoading}
          trendLoading={trendLoading}
          currency={currency}
          locale={locale}
          t={t}
        />
      )}
      {tab === "cashflow" && (
        <CashFlowTab
          trend={trend}
          isLoading={trendLoading}
          currency={currency}
          locale={locale}
          t={t}
        />
      )}
      {tab === "expenses" && (
        <ExpensesTab
          summary={summary}
          merchants={merchants}
          isLoading={isLoading}
          merchantsLoading={merchantsLoading}
          currency={currency}
          t={t}
        />
      )}
      {tab === "income" && (
        <IncomeTab
          summary={summary}
          trend={trend}
          isLoading={isLoading}
          trendLoading={trendLoading}
          currency={currency}
          locale={locale}
          t={t}
        />
      )}
    </div>
  );
}
