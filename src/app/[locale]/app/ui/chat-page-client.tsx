"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import {
  ArrowUpRight,
  CheckCircle,
  PaperPlaneTilt,
  Sparkle,
  Wallet
} from "@phosphor-icons/react/dist/ssr";
import { useMemo, useState } from "react";
import { useLucaBootstrap } from "../hooks/use-luca-bootstrap";

type AiAction = {
  id: string;
  payloadJson: {
    transactions: Array<{
      type: "INCOME" | "EXPENSE" | "TRANSFER";
      amount: number;
      currency: string;
      categoryName?: string | null;
      merchant?: string | null;
      counterparty?: string | null;
      comment?: string | null;
      confidence: number;
    }>;
  };
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: AiAction | null;
};

export function ChatPageClient() {
  const { t, locale } = useI18n();
  const { workspace, defaultAccount, isLoading } = useLucaBootstrap();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "assistant",
      content:
        locale === "ru"
          ? "Расскажи мне, что произошло с деньгами. Например: «Потратил $52 в Nobu вчера» или «Получил $1200 от клиента Alex»."
          : "Tell me what happened with your money. For example: “Spent $52 at Nobu yesterday” or “Got $1200 from client Alex”."
    }
  ]);

  const prompts = useMemo(
    () =>
      locale === "ru"
        ? [
          "Потратил $52 в Nobu вчера",
          "Получил $1200 от клиента Alex",
          "Потратил 300 на рекламу",
          "Потратил 20 на такси"
        ]
        : [
          "Spent $52 at Nobu yesterday",
          "Got $1200 from client Alex",
          "Paid 300 for ads",
          "Spent 20 on taxi"
        ],
    [locale]
  );

  async function sendMessage() {
    if (!input.trim() || !workspace) return;

    const text = input.trim();
    setInput("");
    setIsSending(true);

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: text
      }
    ]);

    try {
      const result = await apiFetch<{
        sessionId: string;
        assistantMessage: { id: string; content: string };
        action: AiAction | null;
      }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: workspace.id,
          sessionId,
          message: text
        })
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
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            locale === "ru"
              ? "Что-то пошло не так. Проверь, что API запущен на 3001."
              : "Something went wrong. Check that API is running on port 3001."
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
      body: JSON.stringify({
        accountId: defaultAccount.id
      })
    });

    setMessages((prev) =>
      prev.map((message) =>
        message.action?.id === actionId
          ? {
            ...message,
            content: t("chat.saved"),
            action: null
          }
          : message
      )
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_370px]">
      <section className="min-h-[calc(100vh-128px)] overflow-hidden rounded-[34px] border border-[rgb(var(--border))] bg-[rgb(var(--surface))]/70 shadow-[0_30px_120px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <header className="flex items-start justify-between border-b border-[rgb(var(--border))] p-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-1.5 text-xs text-[rgb(var(--muted))]">
              <Sparkle size={14} weight="duotone" />
              AI command center
            </div>

            <h1 className="text-4xl font-semibold tracking-[-0.055em]">
              {t("chat.title")}
            </h1>

            <p className="mt-2 text-[rgb(var(--muted))]">{t("chat.subtitle")}</p>
          </div>
        </header>

        <div className="flex h-[calc(100vh-340px)] min-h-[420px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={[
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                ].join(" ")}
              >
                <div
                  className={[
                    "max-w-[82%] rounded-[28px] px-5 py-4 text-sm leading-6",
                    message.role === "user"
                      ? "bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                      : "border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] text-[rgb(var(--foreground))]"
                  ].join(" ")}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {message.action && (
                    <div className="mt-4 space-y-3">
                      {message.action.payloadJson.transactions.map((tx, index) => (
                        <div
                          key={index}
                          className="rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                              {tx.type}
                            </div>
                            <div className="text-xs text-[rgb(var(--muted))]">
                              {Math.round(tx.confidence * 100)}%
                            </div>
                          </div>

                          <div className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                            {tx.type === "EXPENSE" ? "-" : "+"}
                            {tx.amount} {tx.currency}
                          </div>

                          <div className="mt-2 text-sm text-[rgb(var(--muted))]">
                            {tx.categoryName ?? "Uncategorized"}
                            {tx.merchant ? ` · ${tx.merchant}` : ""}
                          </div>
                        </div>
                      ))}

                      <Button
                        onClick={() => confirmAction(message.action!.id)}
                        className="gap-2"
                      >
                        <CheckCircle size={18} weight="fill" />
                        {t("chat.confirmAndSave")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="max-w-[280px] rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-5 py-4 text-sm text-[rgb(var(--muted))]">
                {t("chat.thinking")}
              </div>
            )}
          </div>

          <div className="border-t border-[rgb(var(--border))] p-4">
            <div className="flex gap-3 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] p-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={t("chat.placeholder")}
                className="min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-[rgb(var(--muted))]"
              />

              <button
                onClick={sendMessage}
                disabled={isSending || !input.trim() || isLoading}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-[rgb(var(--foreground))] text-[rgb(var(--background))] transition hover:opacity-90 disabled:opacity-40"
              >
                <PaperPlaneTilt size={19} weight="fill" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[rgb(var(--muted))]">
                Default account
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                {defaultAccount?.name ?? t("common.loading")}
              </div>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-[22px] bg-[rgb(var(--surface-soft))]">
              <Wallet size={22} weight="duotone" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-[rgb(var(--muted))]">
              {t("chat.tryPrompts")}
            </div>
            <ArrowUpRight size={16} weight="bold" />
          </div>

          <div className="space-y-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="w-full rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-4 py-3 text-left text-sm transition hover:border-[rgb(var(--foreground))]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}