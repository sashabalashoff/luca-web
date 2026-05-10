"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { ArrowUpIcon, CheckIcon } from "@phosphor-icons/react/dist/ssr";
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
    { id: "intro", role: "assistant", content: t("chat.intro") }
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasUserMessages = messages.some((m) => m.role === "user");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const prompts = useMemo(
    () =>
      locale === "ru"
        ? ["Потратил $52 в Nobu вчера", "Получил $1200 от клиента", "Потратил 300 на рекламу", "Такси 20 баксов"]
        : ["Spent $52 at Nobu yesterday", "Got $1200 from a client", "Paid $300 for ads", "Taxi $20"],
    [locale]
  );

  function growTextarea(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || !workspace) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsSending(true);

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: msg }]);

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
          content:
            locale === "ru"
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
        m.action?.id === actionId ? { ...m, content: t("chat.saved"), action: null, confirmed: true } : m
      )
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Messages / Welcome */}
      {!hasUserMessages ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Heading — centered in remaining space */}
          <div className="flex flex-1 items-center justify-center px-4">
            <h2 className="text-[28px] font-semibold tracking-tight text-[rgb(var(--foreground))]">
              {locale === "ru" ? "Чем могу помочь?" : "How can I help?"}
            </h2>
          </div>


          <div className="flex overflow-x-auto no-scrollbar gap-2 px-4 pb-3 lg:px-6 md:justify-center">
            {prompts.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="whitespace-nowrap rounded-lg border border-[rgb(var(--border))] px-4 py-1 text-xs text-[rgb(var(--muted))] transition-colors hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto thin-scrollbar">
          <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 lg:px-6">
            {messages.slice(1).map((message) => (
              <MessageRow key={message.id} message={message} onConfirm={confirmAction} t={t} />
            ))}
            {isSending && <ThinkingRow />}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 bg-[rgb(var(--background))]">
        <div className="mx-auto max-w-2xl px-4 pb-5 pt-2 lg:px-6">
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 pb-3 pt-3.5 shadow-sm transition-colors focus-within:border-[rgb(var(--accent))]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                growTextarea(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={t("chat.placeholder")}
              rows={1}
              className="block w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-[rgb(var(--muted))]"
              style={{ minHeight: "24px", maxHeight: "180px" }}
            />
            <div className="mt-2.5 flex justify-end">
              <button
                onClick={() => sendMessage()}
                disabled={isSending || !input.trim() || isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--foreground))] text-[rgb(var(--background))] transition hover:opacity-80 disabled:opacity-20 active:scale-95"
              >
                <ArrowUpIcon size={14} weight="bold" />
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-[rgb(var(--muted-soft))]">
            {locale === "ru"
              ? "Shift+Enter — новая строка"
              : "Shift+Enter for new line"}
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  onConfirm,
  t
}: {
  message: Message;
  onConfirm: (id: string) => void;
  t: (key: string) => string;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[rgb(var(--foreground))] px-4 py-2.5 text-sm leading-relaxed text-[rgb(var(--background))]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-[rgb(var(--foreground))]">
        {message.confirmed && (
          <span className="mr-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[rgb(var(--positive))] align-middle text-white">
            <CheckIcon size={10} weight="bold" />
          </span>
        )}
        {message.content}
      </p>

      {message.action && (
        <div className="space-y-2">
          {message.action.payloadJson.transactions.map((tx, i) => (
            <TxCard key={i} tx={tx} />
          ))}
          <button
            onClick={() => onConfirm(message.action!.id)}
            className="flex h-9 items-center gap-2 rounded-lg bg-[rgb(var(--foreground))] px-4 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 active:scale-[0.98]"
          >
            <CheckIcon size={12} weight="bold" />
            {t("chat.confirmAndSave")}
          </button>
        </div>
      )}
    </div>
  );
}

function TxCard({ tx }: { tx: TxIntent }) {
  const isExpense = tx.type === "EXPENSE";
  const isIncome = tx.type === "INCOME";

  const amountColor = isExpense
    ? "text-[rgb(var(--negative))]"
    : isIncome
      ? "text-[rgb(var(--positive))]"
      : "text-[rgb(var(--foreground))]";

  const badge = isExpense
    ? "bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))]"
    : isIncome
      ? "bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]"
      : "bg-[rgb(var(--surface-soft))] text-[rgb(var(--muted))]";

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3">
      <div className="min-w-0">
        <div className={["text-base font-semibold tabular-nums", amountColor].join(" ")}>
          {isExpense ? "−" : isIncome ? "+" : ""}
          {tx.amount} {tx.currency}
        </div>
        {(tx.categoryName || tx.merchant) && (
          <div className="mt-0.5 truncate text-sm text-[rgb(var(--muted))]">
            {[tx.categoryName, tx.merchant].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className={["rounded-full px-2.5 py-0.5 text-xs font-medium", badge].join(" ")}>
          {tx.type}
        </span>
        <div className="mt-1 text-xs text-[rgb(var(--muted-soft))]">
          {Math.round(tx.confidence * 100)}%
        </div>
      </div>
    </div>
  );
}

function ThinkingRow() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 animate-bounce rounded-full bg-[rgb(var(--muted))]"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}
