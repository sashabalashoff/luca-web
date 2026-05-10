"use client";

import { apiFetch, getAuthToken } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { ArrowUpIcon, CheckIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type TxIntent = {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  currency: string;
  categoryName?: string | null;
  merchant?: string | null;
  counterparty?: string | null;
  comment?: string | null;
  date?: string;
  confidence: number;
};

type AiAction = {
  id: string;
  payloadJson: {
    intent?: string;
    message?: string;
    transactions: TxIntent[];
  };
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: AiAction | null;
  confirmed?: boolean;
  rejected?: boolean;
  streaming?: boolean;
};

const INTRO_ID = "intro";

export function ChatPageClient() {
  const { t, locale } = useI18n();
  const { workspace, defaultAccount, isLoading, reload } = useLuca();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s");

  const [messages, setMessages] = useState<Message[]>([
    { id: INTRO_ID, role: "assistant", content: t("chat.intro") }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Track sessions we just created to avoid re-loading them from API
  const sessionWasCreatedByUs = useRef(new Set<string>());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasUserMessages = messages.some((m) => m.role === "user");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // Load or reset chat when session param changes
  useEffect(() => {
    if (!workspace) return;

    if (!sessionId) {
      setMessages([{ id: INTRO_ID, role: "assistant", content: t("chat.intro") }]);
      return;
    }

    if (sessionWasCreatedByUs.current.has(sessionId)) return;

    setHistoryLoading(true);
    apiFetch<{
      messages: Array<{
        id: string;
        role: string;
        content: string;
        action?: {
          id: string;
          status: string;
          payloadJson: AiAction["payloadJson"];
        } | null;
      }>;
    }>(`/api/ai/chat/sessions/${sessionId}/messages`)
      .then((data) => {
        const mapped: Message[] = data.messages.map((msg) => ({
          id: msg.id,
          role: msg.role === "USER" ? "user" : "assistant",
          content: msg.content,
          action:
            msg.action && msg.action.status === "PENDING"
              ? { id: msg.action.id, payloadJson: msg.action.payloadJson }
              : null,
          confirmed: msg.action?.status === "EXECUTED",
          rejected: msg.action?.status === "REJECTED"
        }));
        setMessages(mapped);
      })
      .catch(console.error)
      .finally(() => setHistoryLoading(false));
  }, [sessionId, workspace]);

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

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: msg },
      { id: assistantMsgId, role: "assistant", content: "", streaming: true }
    ]);

    try {
      const token = await getAuthToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ workspaceId: workspace.id, sessionId, message: msg })
      });

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop()!;

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let eventType = "message";
          let data = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) data = line.slice(6);
          }

          if (!data) continue;

          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(data);
          } catch {
            continue;
          }

          if (eventType === "text") {
            const delta = payload.delta as string;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + delta } : m
              )
            );
          } else if (eventType === "action") {
            const actionId = payload.actionId as string;
            const parsed = payload.parsed as AiAction["payloadJson"];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, action: { id: actionId, payloadJson: parsed } }
                  : m
              )
            );
          } else if (eventType === "done") {
            const newSessionId = payload.sessionId as string;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, streaming: false } : m
              )
            );
            if (newSessionId && newSessionId !== sessionId) {
              sessionWasCreatedByUs.current.add(newSessionId);
              router.replace(`?s=${newSessionId}`, { scroll: false });
            }
          } else if (eventType === "error") {
            const errMsg = (payload.message as string) || t("chat.error");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: errMsg, streaming: false } : m
              )
            );
          }
        }
      }
    } catch {
      const errContent = t("chat.error");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: errContent, streaming: false } : m
        )
      );
    } finally {
      setIsSending(false);
    }
  }

  async function confirmAction(actionId: string) {
    if (!defaultAccount) return;
    try {
      await apiFetch(`/api/ai/actions/${actionId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ accountId: defaultAccount.id })
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.action?.id === actionId ? { ...m, confirmed: true, action: null } : m
        )
      );
      reload();
    } catch (err) {
      console.error(err);
    }
  }

  async function rejectAction(actionId: string) {
    try {
      await apiFetch(`/api/ai/actions/${actionId}/reject`, { method: "POST" });
      setMessages((prev) =>
        prev.map((m) =>
          m.action?.id === actionId ? { ...m, rejected: true, action: null } : m
        )
      );
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {historyLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block h-2 w-2 animate-bounce rounded-full bg-[rgb(var(--muted))]"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        </div>
      ) : !hasUserMessages ? (
        /* Welcome screen */
        <div className="flex flex-1 flex-col overflow-hidden">
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
        /* Messages list */
        <div className="flex-1 overflow-y-auto thin-scrollbar">
          <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 lg:px-6">
            {messages
              .filter((m) => m.id !== INTRO_ID)
              .map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  onConfirm={confirmAction}
                  onReject={rejectAction}
                  t={t}
                />
              ))}
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
            {locale === "ru" ? "Shift+Enter — новая строка" : "Shift+Enter for new line"}
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  onConfirm,
  onReject,
  t
}: {
  message: Message;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
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

  // Thinking state: streaming but no content yet
  if (message.streaming && !message.content) {
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

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[rgb(var(--foreground))]">
        {message.confirmed && (
          <span className="mr-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[rgb(var(--positive))] align-middle text-white">
            <CheckIcon size={10} weight="bold" />
          </span>
        )}
        {message.content}
        {message.streaming && (
          <span className="ml-0.5 inline-block h-[13px] w-[2px] animate-pulse bg-[rgb(var(--foreground))] align-middle" />
        )}
      </p>

      {message.action && (
        <div className="space-y-2">
          {message.action.payloadJson.transactions.map((tx, i) => (
            <TxCard key={i} tx={tx} t={t} />
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => onConfirm(message.action!.id)}
              className="flex h-9 items-center gap-2 rounded-lg bg-[rgb(var(--foreground))] px-4 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 active:scale-[0.98]"
            >
              <CheckIcon size={12} weight="bold" />
              {t("chat.confirmAndSave")}
            </button>
            <button
              onClick={() => onReject(message.action!.id)}
              className="flex h-9 items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-4 text-sm text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.98]"
            >
              <XIcon size={12} />
              {t("chat.reject")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TxCard({ tx, t }: { tx: TxIntent; t: (key: string) => string }) {
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

  const typeLabel = isExpense
    ? t("transactions.expense")
    : isIncome
      ? t("transactions.income")
      : t("transactions.transfer");

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3">
      <div className="min-w-0">
        <div className={["text-base font-semibold tabular-nums", amountColor].join(" ")}>
          {isExpense ? "−" : isIncome ? "+" : ""}
          {tx.amount} {tx.currency}
        </div>
        {(tx.categoryName || tx.merchant || tx.counterparty) && (
          <div className="mt-0.5 truncate text-sm text-[rgb(var(--muted))]">
            {[tx.categoryName, tx.merchant || tx.counterparty].filter(Boolean).join(" · ")}
          </div>
        )}
        {tx.comment && (
          <div className="truncate text-xs text-[rgb(var(--muted-soft))]">{tx.comment}</div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className={["rounded-full px-2.5 py-0.5 text-xs font-medium", badge].join(" ")}>
          {typeLabel}
        </span>
        <div className="mt-1 text-xs text-[rgb(var(--muted-soft))]">
          {Math.round(tx.confidence * 100)}%
        </div>
      </div>
    </div>
  );
}
