"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { Card } from "@/shared/ui/card";
import { ArrowDown, ArrowUp, CreditCard } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";
import { useLucaBootstrap } from "../../hooks/use-luca-bootstrap";

type Transaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: string;
  currency: string;
  date: string;
  merchant?: string | null;
  comment?: string | null;
  category?: {
    name: string;
  } | null;
};

export function TransactionsPageClient() {
  const { t } = useI18n();
  const { workspace, isLoading } = useLucaBootstrap();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!workspace) return;

    apiFetch<{ transactions: Transaction[] }>(
      `/api/transactions?workspaceId=${workspace.id}`
    )
      .then((result) => setTransactions(result.transactions))
      .catch(console.error);
  }, [workspace]);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-xs text-[rgb(var(--muted))]">
            <CreditCard size={14} weight="duotone" />
            {t("transactions.subtitle")}
          </div>

          <h1 className="text-4xl font-semibold tracking-[-0.055em]">
            {t("transactions.title")}
          </h1>
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-sm text-[rgb(var(--muted))]">
            {t("common.loading")}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-sm text-[rgb(var(--muted))]">
            {t("transactions.empty")}
          </div>
        ) : (
          <div className="divide-y divide-[rgb(var(--border))]">
            {transactions.map((tx) => {
              const isExpense = tx.type === "EXPENSE";
              const Icon = isExpense ? ArrowDown : ArrowUp;

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={[
                        "flex h-12 w-12 items-center justify-center rounded-[22px]",
                        isExpense
                          ? "bg-red-500/10 text-[rgb(var(--negative))]"
                          : "bg-emerald-500/10 text-[rgb(var(--positive))]"
                      ].join(" ")}
                    >
                      <Icon size={19} weight="bold" />
                    </div>

                    <div>
                      <div className="font-medium">
                        {tx.merchant ||
                          tx.comment ||
                          tx.category?.name ||
                          tx.type}
                      </div>
                      <div className="mt-1 text-sm text-[rgb(var(--muted))]">
                        {tx.category?.name ?? "Uncategorized"} ·{" "}
                        {new Date(tx.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div
                    className={[
                      "text-right text-lg font-semibold tracking-[-0.03em]",
                      isExpense
                        ? "text-[rgb(var(--negative))]"
                        : "text-[rgb(var(--positive))]"
                    ].join(" ")}
                  >
                    {isExpense ? "-" : "+"}
                    {Number(tx.amount).toFixed(2)} {tx.currency}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}