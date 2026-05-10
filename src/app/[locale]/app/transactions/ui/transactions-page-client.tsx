"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowsLeftRightIcon,
  TrashIcon
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";

type Transaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: string;
  currency: string;
  date: string;
  merchant?: string | null;
  comment?: string | null;
  category?: { name: string; icon?: string | null } | null;
};

type DayGroup = {
  label: string;
  iso: string;
  items: Transaction[];
};

function groupByDay(txs: Transaction[]): DayGroup[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const key = tx.date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([iso, items]) => ({
      iso,
      label: new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric"
      }),
      items
    }));
}

export function TransactionsPageClient() {
  const { t } = useI18n();
  const { workspace, isLoading: bootstrapLoading, reload: reloadContext } = useLuca();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadTransactions() {
    if (!workspace) return;
    setLoading(true);
    apiFetch<{ transactions: Transaction[] }>(
      `/api/transactions?workspaceId=${workspace.id}`
    )
      .then((r) => setTransactions(r.transactions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTransactions();
  }, [workspace]);

  async function deleteTransaction(id: string) {
    setDeletingId(id);
    try {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
      reloadContext();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  const groups = groupByDay(transactions);
  const isSpinning = bootstrapLoading || loading;

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("transactions.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("transactions.subtitle")}</p>
        </div>
        <div className="text-sm text-[rgb(var(--muted))]">
          {!isSpinning && transactions.length > 0 && `${transactions.length}`}
        </div>
      </div>

      {isSpinning ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-[rgb(var(--surface))] border border-[rgb(var(--border))]"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <div className="mb-3 text-3xl opacity-20">💸</div>
          <p className="text-sm text-[rgb(var(--muted))]">{t("transactions.empty")}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.iso}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-widest text-[rgb(var(--muted))]">
                  {group.label}
                </span>
                <span className="text-xs text-[rgb(var(--muted))]">
                  {group.items.length === 1
                    ? "1 transaction"
                    : `${group.items.length} transactions`}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
                {group.items.map((tx, idx) => (
                  <TxRow
                    key={tx.id}
                    tx={tx}
                    isLast={idx === group.items.length - 1}
                    isDeleting={deletingId === tx.id}
                    onDelete={() => deleteTransaction(tx.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TxRow({
  tx,
  isLast,
  isDeleting,
  onDelete
}: {
  tx: Transaction;
  isLast: boolean;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  const isExpense = tx.type === "EXPENSE";
  const isIncome = tx.type === "INCOME";
  const amount = Number(tx.amount);
  const label = tx.merchant || tx.category?.name || tx.comment || tx.type;
  const sub = tx.merchant && tx.category?.name ? tx.category.name : null;

  return (
    <div
      className={[
        "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[rgb(var(--surface-soft))]",
        !isLast ? "border-b border-[rgb(var(--border-soft))]" : "",
        isDeleting ? "opacity-40" : ""
      ].join(" ")}
    >
      {/* Type icon */}
      <div
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs",
          isExpense
            ? "bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))]"
            : isIncome
            ? "bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]"
            : "bg-[rgb(var(--surface-soft))] text-[rgb(var(--muted))]"
        ].join(" ")}
      >
        {tx.category?.icon ? (
          <span className="text-sm leading-none">{tx.category.icon}</span>
        ) : isExpense ? (
          <ArrowDownIcon size={14} weight="bold" />
        ) : isIncome ? (
          <ArrowUpIcon size={14} weight="bold" />
        ) : (
          <ArrowsLeftRightIcon size={14} weight="bold" />
        )}
      </div>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[rgb(var(--foreground))]">
          {label}
        </div>
        {sub && (
          <div className="truncate text-xs text-[rgb(var(--muted))]">{sub}</div>
        )}
      </div>

      {/* Amount */}
      <div
        className={[
          "shrink-0 text-sm font-semibold tabular-nums",
          isExpense
            ? "text-[rgb(var(--negative))]"
            : isIncome
            ? "text-[rgb(var(--positive))]"
            : "text-[rgb(var(--foreground))]"
        ].join(" ")}
      >
        {isExpense ? "−" : isIncome ? "+" : ""}
        {amount.toFixed(2)} {tx.currency}
      </div>

      {/* Delete button — visible on hover */}
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--muted))] opacity-0 transition-all hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))] group-hover:opacity-100 disabled:opacity-30"
        title="Delete"
      >
        <TrashIcon size={13} weight="bold" />
      </button>
    </div>
  );
}
