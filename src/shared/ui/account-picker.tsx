"use client";

import { CheckIcon } from "@phosphor-icons/react/dist/ssr";

export interface PickerAccount {
  id: string;
  name: string;
  currency: string;
  currentBalance?: string | number;
  type?: string;
  isDebt?: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  CASH: "💵",
  CARD: "💳",
  BANK: "🏦",
  WISE: "🌍",
  PAYPAL: "🅿️",
  CRYPTO: "₿",
  OTHER: "🪙",
};

interface AccountPickerProps {
  accounts: PickerAccount[];
  value: string | undefined;
  onChange: (id: string) => void;
  label?: string;
}

export function AccountPicker({ accounts, value, onChange, label }: AccountPickerProps) {
  return (
    <div>
      {label && (
        <label className="mb-2 block text-xs font-medium text-[rgb(var(--muted))]">{label}</label>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {accounts.map((acc) => {
          const isSelected = acc.id === value;
          const balance = acc.currentBalance != null ? Number(acc.currentBalance) : null;
          const icon = (acc.type ? TYPE_ICONS[acc.type] : undefined) ?? "💰";
          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => onChange(acc.id)}
              className={[
                "flex min-w-[120px] shrink-0 flex-col gap-1.5 rounded-xl border p-3 text-left transition active:scale-[0.97]",
                isSelected
                  ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.06)] ring-1 ring-[rgb(var(--accent)/0.3)]"
                  : "border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] hover:border-[rgb(var(--border))] hover:bg-[rgb(var(--surface))]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">{icon}</span>
                {isSelected && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-white">
                    <CheckIcon size={9} weight="bold" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-[rgb(var(--foreground))]">
                  {acc.name}
                </div>
                {balance != null && (
                  <div
                    className={[
                      "mt-0.5 text-[11px] font-semibold tabular-nums",
                      acc.isDebt || balance < 0 ? "text-[rgb(var(--negative))]" : "text-[rgb(var(--foreground))]",
                    ].join(" ")}
                  >
                    {balance < 0 ? "-" : ""}
                    {Math.abs(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                    <span className="font-normal text-[rgb(var(--muted))]">{acc.currency}</span>
                  </div>
                )}
                {balance == null && (
                  <div className="mt-0.5 text-[11px] text-[rgb(var(--muted))]">{acc.currency}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
