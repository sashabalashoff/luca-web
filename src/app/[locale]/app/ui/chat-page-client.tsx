"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { AppIcons } from "@/shared/icons/app-icons";
import { useLuca } from "@/shared/providers/luca-provider";
import { CheckIcon, PaperPlaneTiltIcon, SparkleIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useMemo, useRef, useState } from "react";

type TxIntent = {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  currency: string;
  categoryName?: string | null;
  merchant?: string | null;
  comment?: string | null;
  confidence: number;
};

type AiAction = {
  id: string;
  payloadJson: { transactions: TxIntent[] };
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: AiAction | null;
  confirmed?: boolean;
};

export function ChatPageClient() {
  const { t, locale } = useI18n();
  const { workspace, defaultAccount, isLoading } = useLuca();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "assistant",
      content: t("chat.intro")
    }
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const prompts = useMemo(
    () =>
      locale === "ru"
        ? ["Потратил $52 в Nobu вчера", "Получил $1200 от клиента Alex", "Потратил 300 на рекламу", "Такси 20 баксов"]
        : ["Spent $52 at Nobu yesterday", "Got $1200 from client Alex", "Paid $300 for ads", "Taxi $20"],
    [locale]
  );

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || !workspace) return;

    setInput("");
    setIsSending(true);

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: msg }
    ]);

    try {
      const result = await apiFetch<{
        sessionId: string;
        assistantMessage: { id: string; content: string };
        action: AiAction | null;
      }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ workspaceId: workspace.id, sessionId, message: msg })
      });

      setSessionId(result.sessionId);
      setMessages((prev) => [
        ...prev,
        {
          id: result.assistantMessage.id,
          role: "assistant",
          content: result.assistantMessage.content,
          action: result.action
        }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: locale === "ru"
            ? "Что-то пошло не так. Проверь, что API запущен на 3001."
            : "Something went wrong. Make sure the API is running on port 3001."
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function confirmAction(actionId: string) {
    if (!defaultAccount) return;
    await apiFetch(`/api/ai/actions/${actionId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ accountId: defaultAccount.id })
    });
    setMessages((prev) =>
      prev.map((m) =>
        m.action?.id === actionId
          ? { ...m, content: t("chat.saved"), action: null, confirmed: true }
          : m
      )
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-var(--header-height)-48px)] max-w-3xl flex-col gap-0">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--accent-dim))]">
          <SparkleIcon size={14} weight="fill" className="text-[rgb(var(--accent))]" />
        </div>
        <h1 className="text-base font-semibold">{t("chat.title")}</h1>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="flex-1 space-y-3 overflow-y-auto p-4 no-scrollbar">
          {messages.map((message) => (
            <div
              key={message.id}
              className={["flex gap-3", message.role === "user" ? "justify-end" : "justify-start"].join(" ")}
            >
              {message.role === "assistant" && (
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent-dim))] text-[rgb(var(--accent))]">
                  <SparkleIcon size={12} weight="fill" />
                </div>
              )}

              <div className={["max-w-[78%]", message.role === "user" ? "items-end" : "items-start", "flex flex-col gap-2"].join(" ")}>
                <div
                  className={[
                    "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    message.role === "user"
                      ? "bg-[rgb(var(--foreground))] text-[rgb(var(--background))] rounded-br-sm"
                      : "bg-[rgb(var(--surface-soft))] text-[rgb(var(--foreground))] rounded-bl-sm"
                  ].join(" ")}
                >
                  {message.confirmed && (
                    <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[rgb(var(--positive))] text-white">
                      <CheckIcon size={10} weight="bold" />
                    </span>
                  )}
                  {message.content}
                </div>

                {message.action && (
                  <div className="w-full space-y-2">
                    {message.action.payloadJson.transactions.map((tx, i) => (
                      <TxCard key={i} tx={tx} />
                    ))}
                    <button
                      onClick={() => confirmAction(message.action!.id)}
                      className="flex h-9 items-center gap-2 rounded-xl bg-[rgb(var(--foreground))] px-4 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 active:scale-[0.98]"
                    >
                      <CheckIcon size={14} weight="bold" />
                      {t("chat.confirmAndSave")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex gap-3">
              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent-dim))] text-[rgb(var(--accent))]">
                <SparkleIcon size={12} weight="fill" />
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-[rgb(var(--surface-soft))] px-4 py-2.5 text-sm text-[rgb(var(--muted))]">
                <ThinkingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[rgb(var(--border))] px-3 py-3">
          {!messages.some((m) => m.role === "user") && (
            <div className="mb-3 flex flex-wrap gap-2">
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-1.5 text-xs text-[rgb(var(--muted))] transition hover:border-[rgb(var(--accent)/0.4)] hover:text-[rgb(var(--foreground))]"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={t("chat.placeholder")}
              rows={1}
              className="min-h-9 flex-1 resize-none rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-2 text-sm outline-none transition placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--accent))] focus:ring-1 focus:ring-[rgb(var(--accent)/0.2)]"
            />
            <button
              onClick={() => sendMessage()}
              disabled={isSending || !input.trim() || isLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--foreground))] text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-35 active:scale-95"
            >
              <PaperPlaneTiltIcon size={15} weight="fill" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
          <AppIcons.wallet size={13} weight="duotone" />
          {defaultAccount
            ? `${defaultAccount.name} · ${defaultAccount.currency} ${Number(defaultAccount.currentBalance).toLocaleString()}`
            : t("common.loading")}
        </div>
      </div>
    </div>
  );
}

function TxCard({ tx }: { tx: TxIntent }) {
  const isExpense = tx.type === "EXPENSE";
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
            {tx.type}
          </div>
          <div className={["mt-1 text-xl font-semibold tracking-tight", isExpense ? "text-[rgb(var(--negative))]" : "text-[rgb(var(--positive))]"].join(" ")}>
            {isExpense ? "−" : "+"}{tx.amount} {tx.currency}
          </div>
          {(tx.categoryName || tx.merchant) && (
            <div className="mt-1 text-xs text-[rgb(var(--muted))]">
              {[tx.categoryName, tx.merchant].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <div className="rounded-md bg-[rgb(var(--surface-soft))] px-2 py-0.5 text-xs text-[rgb(var(--muted))]">
          {Math.round(tx.confidence * 100)}%
        </div>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
