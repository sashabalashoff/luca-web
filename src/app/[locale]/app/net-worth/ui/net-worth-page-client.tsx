"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BankIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";

type NetWorthAccount = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  balanceInBase: number;
  isDebt: boolean;
};

type NetWorthData = {
  baseCurrency: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  accounts: NetWorthAccount[];
};

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function NetWorthPageClient() {
  const { t } = useI18n();
  const { workspace, transactionKey } = useLuca();
  const [data, setData] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    let active = true;
    setLoading(true);
    setError(false);
    apiFetch<NetWorthData>(`/api/reports/net-worth?workspaceId=${workspace.id}`)
      .then((d) => { if (active) setData(d); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspace, transactionKey]);

  const assets = data?.accounts.filter((a) => !a.isDebt) ?? [];
  const liabilities = data?.accounts.filter((a) => a.isDebt) ?? [];
  const currency = data?.baseCurrency ?? workspace?.baseCurrency ?? "USD";
  const isPositive = (data?.netWorth ?? 0) >= 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("netWorth.title")}</h1>
        <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("netWorth.subtitle")}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-[rgb(var(--negative-dim))] bg-[rgb(var(--negative-dim))] px-4 py-3 text-sm text-[rgb(var(--negative))]">
          {t("common.errorLoading")}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label={t("netWorth.netWorth")}
          value={loading ? null : fmt(data?.netWorth ?? 0, currency)}
          color={isPositive ? "accent" : "negative"}
        />
        <SummaryCard
          label={t("netWorth.totalAssets")}
          value={loading ? null : fmt(data?.totalAssets ?? 0, currency)}
          color="positive"
          icon={ArrowUpRightIcon}
        />
        <SummaryCard
          label={t("netWorth.totalLiabilities")}
          value={loading ? null : fmt(data?.totalLiabilities ?? 0, currency)}
          color="negative"
          icon={ArrowDownRightIcon}
        />
      </div>

      {/* Assets */}
      {(loading || assets.length > 0) && (
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <div className="border-b border-[rgb(var(--border-soft))] px-5 py-4">
            <span className="text-sm font-semibold text-[rgb(var(--positive))]">{t("netWorth.assets")}</span>
          </div>
          {loading ? (
            <LoadingSkeleton />
          ) : (
            assets.map((acc, idx) => (
              <AccountRow
                key={acc.id}
                acc={acc}
                baseCurrency={currency}
                isLast={idx === assets.length - 1}
              />
            ))
          )}
        </div>
      )}

      {/* Liabilities */}
      {(loading || liabilities.length > 0) && (
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <div className="border-b border-[rgb(var(--border-soft))] px-5 py-4">
            <span className="text-sm font-semibold text-[rgb(var(--negative))]">{t("netWorth.liabilities")}</span>
          </div>
          {loading ? (
            <LoadingSkeleton />
          ) : (
            liabilities.map((acc, idx) => (
              <AccountRow
                key={acc.id}
                acc={acc}
                baseCurrency={currency}
                isLast={idx === liabilities.length - 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  color: "accent" | "positive" | "negative";
  icon?: React.ElementType;
}) {
  const colorMap = {
    accent: {
      bg: "bg-[rgb(var(--accent-dim))]",
      text: "text-[rgb(var(--accent))]",
      iconBg: "bg-[rgb(var(--accent))]/15",
    },
    positive: {
      bg: "bg-[rgb(var(--positive-dim))]",
      text: "text-[rgb(var(--positive))]",
      iconBg: "bg-[rgb(var(--positive-dim))]",
    },
    negative: {
      bg: "bg-[rgb(var(--negative-dim))]",
      text: "text-[rgb(var(--negative))]",
      iconBg: "bg-[rgb(var(--negative-dim))]",
    },
  };

  const { bg, text, iconBg } = colorMap[color];

  return (
    <div className={["rounded-2xl border border-[rgb(var(--border))] p-5", bg].join(" ")}>
      {Icon && (
        <div className={["mb-3 inline-flex h-8 w-8 items-center justify-center rounded-xl", iconBg].join(" ")}>
          <Icon size={15} weight="duotone" className={text} />
        </div>
      )}
      <div className="text-xs font-medium text-[rgb(var(--muted))]">{label}</div>
      {value === null ? (
        <div className="mt-1.5 h-6 w-28 animate-pulse rounded-md bg-[rgb(var(--surface-soft))]" />
      ) : (
        <div className={["mt-1.5 text-xl font-semibold tracking-tight tabular-nums", text].join(" ")}>
          {value}
        </div>
      )}
    </div>
  );
}

function AccountRow({
  acc,
  baseCurrency,
  isLast,
}: {
  acc: NetWorthAccount;
  baseCurrency: string;
  isLast: boolean;
}) {
  const isForeign = acc.currency !== baseCurrency;
  const displayBalance = acc.isDebt ? -Math.abs(acc.balance) : acc.balance;

  return (
    <div
      className={[
        "flex items-center gap-3 px-5 py-3.5",
        !isLast ? "border-b border-[rgb(var(--border-soft))]" : "",
      ].join(" ")}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-soft))]">
        <BankIcon size={14} className="text-[rgb(var(--muted))]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[rgb(var(--foreground))]">{acc.name}</div>
        <div className="text-[11px] text-[rgb(var(--muted))]">{acc.type}</div>
      </div>
      <div className="text-right">
        <div
          className={[
            "text-sm font-semibold tabular-nums",
            acc.isDebt ? "text-[rgb(var(--negative))]" : "text-[rgb(var(--foreground))]",
          ].join(" ")}
        >
          {acc.currency} {displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {isForeign && (
          <div className="text-[11px] text-[rgb(var(--muted))]">
            ≈ {baseCurrency} {acc.balanceInBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-px p-5">
      {[1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-[rgb(var(--surface-soft))]" />
      ))}
    </div>
  );
}
