"use client";

import { apiFetch, getAuthToken } from "@/shared/api/client";
import type {
  AiOperation,
  CreateAccountOp,
  CreateCategoriesOp,
  CreateGoalOp,
  CreateTransactionsOp,
  ParsedTransaction,
  SetBudgetOp,
} from "@/shared/api/types";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { AccountPicker } from "@/shared/ui/account-picker";
import {
  ArrowUpIcon,
  BankIcon,
  CheckIcon,
  FolderIcon,
  MicrophoneIcon,
  PencilSimpleIcon,
  SlidersIcon,
  StopCircleIcon,
  TargetIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type TransactionOverride = {
  accountId?: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amount?: number;
  currency?: string;
  date?: string;
  merchant?: string | null;
  comment?: string | null;
};

type ChatAction = {
  id: string;
  status: string;
  operations: AiOperation[];
  overrides?: TransactionOverride[];
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: ChatAction | null;
  confirmed?: boolean;
  rejected?: boolean;
  streaming?: boolean;
  savedOperations?: AiOperation[];
};

const INTRO_ID = "intro";

function extractOperations(payloadJson: Record<string, unknown>): AiOperation[] {
  if (Array.isArray(payloadJson.operations) && payloadJson.operations.length > 0) {
    return payloadJson.operations as AiOperation[];
  }
  if (Array.isArray(payloadJson.transactions) && payloadJson.transactions.length > 0) {
    return [{ type: "CREATE_TRANSACTIONS", transactions: payloadJson.transactions }] as AiOperation[];
  }
  return [];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChatPageClient() {
  const { t, locale } = useI18n();
  const { workspace, accounts, defaultAccount, isLoading, reload } = useLuca();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s");

  const [messages, setMessages] = useState<Message[]>([
    { id: INTRO_ID, role: "assistant", content: t("chat.intro") },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const sessionWasCreatedByUs = useRef(new Set<string>());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const voiceBaseRef = useRef("");

  const hasUserMessages = messages.some((m) => m.role === "user");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return; // skip Enter, Escape, F-keys, etc.
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      textareaRef.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // When sessionId disappears (user starts new chat), reset to intro — React derived-state pattern
  const [trackedSessionId, setTrackedSessionId] = useState(sessionId);
  if (trackedSessionId !== sessionId) {
    setTrackedSessionId(sessionId);
    if (!sessionId) {
      setMessages([{ id: INTRO_ID, role: "assistant", content: t("chat.intro") }]);
    }
  }

  useEffect(() => {
    if (!workspace || !sessionId) return;

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
          payloadJson: Record<string, unknown>;
        } | null;
      }>;
    }>(`/api/ai/chat/sessions/${sessionId}/messages`)
      .then((data) => {
        const mapped: Message[] = data.messages.map((msg) => {
          const ops = msg.action ? extractOperations(msg.action.payloadJson) : [];
          return {
            id: msg.id,
            role: msg.role === "USER" ? "user" : "assistant",
            content: msg.content,
            action:
              msg.action && msg.action.status === "PENDING" && ops.length > 0
                ? { id: msg.action.id, status: msg.action.status, operations: ops }
                : null,
            confirmed: msg.action?.status === "EXECUTED",
            rejected: msg.action?.status === "REJECTED",
            savedOperations: msg.action?.status === "EXECUTED" ? ops : undefined,
          };
        });
        setMessages(mapped);
      })
      .catch(console.error)
      .finally(() => setHistoryLoading(false));
  }, [sessionId, workspace]);

  function growTextarea(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }

  async function sendMessage(text?: string) {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }

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
      { id: assistantMsgId, role: "assistant", content: "", streaming: true },
    ]);

    try {
      const token = await getAuthToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ workspaceId: workspace.id, sessionId, message: msg }),
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
            const operations = (payload.operations as AiOperation[]) ?? [];

            // Build initial overrides: pre-select account based on AI's accountName hint
            const overrides = buildInitialOverrides(operations, accounts, defaultAccount?.id);

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, action: { id: actionId, status: "PENDING", operations, overrides } }
                  : m
              )
            );
          } else if (eventType === "done") {
            const newSessionId = payload.sessionId as string;
            const finalMessage = payload.finalMessage as string | undefined;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, streaming: false, content: finalMessage ?? m.content }
                  : m
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
    const msg = messages.find((m) => m.action?.id === actionId);
    const action = msg?.action;
    if (!action) return;

    const operations = action.operations ?? [];
    const overrides = action.overrides ?? [];

    const hasTx = operations.some((op) => op.type === "CREATE_TRANSACTIONS");
    if (hasTx && !defaultAccount) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.action?.id === actionId
          ? { ...m, confirmed: true, action: null, savedOperations: operations }
          : m
      )
    );

    try {
      await apiFetch(`/api/ai/actions/${actionId}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          accountId: defaultAccount?.id ?? null,
          transactionOverrides: overrides,
        }),
      });
      reload();
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.confirmed && m.savedOperations === operations
            ? { ...m, confirmed: false, action, savedOperations: undefined }
            : m
        )
      );
    }
  }

  function toggleRecording() {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR: (new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start(): void;
      stop(): void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onresult: ((e: any) => void) | null;
      onend: (() => void) | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onerror: ((e: any) => void) | null;
    }) | undefined = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SR) return;

    // On mobile, Android's Web Speech API fires each word as a new entry in
    // event.results rather than updating in place, so interim results cause
    // duplicate accumulation. Disable them on mobile — final-only is reliable.
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

    // Blur to prevent Android IME from interfering with programmatic setInput
    if (isMobile) textareaRef.current?.blur();

    voiceBaseRef.current = input;

    const recognition = new SR();
    recognition.lang = locale === "ru" ? "ru-RU" : "en-US";
    recognition.interimResults = !isMobile;
    recognition.continuous = !isMobile;

    recognition.onresult = (event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += (finalText ? " " : "") + t;
        } else {
          interim += t;
        }
      }
      const spoken = finalText + (interim ? (finalText ? " " : "") + interim : "");
      const base = voiceBaseRef.current;
      setInput(base ? (spoken ? `${base} ${spoken}` : base) : spoken);
      requestAnimationFrame(() => {
        if (textareaRef.current) growTextarea(textareaRef.current);
      });
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      requestAnimationFrame(() => textareaRef.current?.focus());
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error !== "aborted") console.error("[voice] error:", event.error);
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }

  async function rejectAction(actionId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.action?.id === actionId ? { ...m, rejected: true, action: null } : m
      )
    );
    try {
      await apiFetch(`/api/ai/actions/${actionId}/reject`, { method: "POST" });
    } catch (err) {
      console.error(err);
    }
  }

  function updateOverride(actionId: string, txIndex: number, patch: Partial<TransactionOverride>) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.action?.id !== actionId) return m;
        const overrides = [...(m.action.overrides ?? [])];
        overrides[txIndex] = { ...(overrides[txIndex] ?? {}), ...patch };
        return { ...m, action: { ...m.action, overrides } };
      })
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {historyLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Dots />
        </div>
      ) : !hasUserMessages ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
          <h2 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">
            {locale === "ru" ? "Чем могу помочь?" : "How can I help?"}
          </h2>
          <p className="max-w-sm text-center text-sm text-[rgb(var(--muted))]">
            {t("chat.subtitle")}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto thin-scrollbar">
          <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 lg:px-6">
            {messages
              .filter((m) => m.id !== INTRO_ID)
              .map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  accounts={accounts}
                  onConfirm={confirmAction}
                  onReject={rejectAction}
                  onUpdateOverride={updateOverride}
                  t={t}
                  locale={locale}
                />
              ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <div className="shrink-0 bg-[rgb(var(--background))] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl px-3 pb-4 pt-2 sm:px-4 sm:pb-5 lg:px-6">
          <div
            className={[
              "flex items-end gap-2 rounded-2xl border bg-[rgb(var(--surface))] px-3 py-2.5 shadow-sm transition-colors sm:px-4 sm:py-3",
              isRecording
                ? "border-[rgb(var(--negative))]"
                : "border-[rgb(var(--border))] focus-within:border-[rgb(var(--accent))]",
            ].join(" ")}
          >
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
              placeholder={
                isRecording
                  ? (locale === "ru" ? "Говорите..." : "Listening...")
                  : t("chat.placeholder")
              }
              rows={1}
              className="flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed outline-none placeholder:text-[rgb(var(--muted))]"
              style={{ minHeight: "24px", maxHeight: "160px" }}
            />
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isSending || isLoading}
              title={isRecording ? t("chat.stopRecording") : t("chat.startRecording")}
              className={[
                "shrink-0 flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95 disabled:pointer-events-none disabled:opacity-40",
                isRecording
                  ? "bg-[rgb(var(--negative))] text-white"
                  : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
              ].join(" ")}
            >
              {isRecording ? (
                <StopCircleIcon size={16} weight="fill" />
              ) : (
                <MicrophoneIcon size={16} weight="regular" />
              )}
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={isSending || !input.trim() || isLoading}
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--foreground))] text-[rgb(var(--background))] transition hover:opacity-80 disabled:opacity-20 active:scale-95"
            >
              <ArrowUpIcon size={15} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInitialOverrides(
  operations: AiOperation[],
  accounts: { id: string; name: string }[],
  defaultAccountId?: string
): TransactionOverride[] {
  const overrides: TransactionOverride[] = [];
  for (const op of operations) {
    if (op.type !== "CREATE_TRANSACTIONS") continue;
    for (const tx of (op as CreateTransactionsOp).transactions) {
      let accountId = defaultAccountId;
      if (tx.accountName) {
        const lower = tx.accountName.toLowerCase();
        const match = accounts.find(
          (a) => a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase())
        );
        if (match) accountId = match.id;
      }

      // For transfers, pre-select a different account as the destination
      let toAccountId: string | undefined;
      if (tx.type === "TRANSFER" && accounts.length > 1) {
        const other = accounts.find((a) => a.id !== accountId);
        toAccountId = other?.id;
      }

      overrides.push({ accountId, toAccountId });
    }
  }
  return overrides;
}

// ─── Loading dots ─────────────────────────────────────────────────────────────

function Dots() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-2 w-2 animate-bounce rounded-full bg-[rgb(var(--muted))]"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

// ─── Message row ──────────────────────────────────────────────────────────────

function MessageRow({
  message,
  accounts,
  onConfirm,
  onReject,
  onUpdateOverride,
  t,
  locale,
}: {
  message: Message;
  accounts: { id: string; name: string; currency: string }[];
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onUpdateOverride: (actionId: string, txIndex: number, patch: Partial<TransactionOverride>) => void;
  t: (key: string) => string;
  locale: string;
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

  if (message.streaming && !message.content && !message.action) {
    return (
      <div className="flex items-center gap-1.5">
        <Dots />
      </div>
    );
  }

  // Build flat index for overrides across all tx operations
  let txOverrideIndex = 0;

  return (
    <div className="space-y-3">
      {message.content && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[rgb(var(--foreground))]">
          {message.content}
          {message.streaming && (
            <span className="ml-0.5 inline-block h-[13px] w-[2px] animate-pulse bg-[rgb(var(--foreground))] align-middle" />
          )}
        </p>
      )}

      {/* Pending confirmation */}
      {message.action && (
        <div className="space-y-2">
          {message.action.operations.length > 1 && (
            <p className="text-xs font-medium text-[rgb(var(--muted))]">
              {message.action.operations.length} {t("chat.operationsCount")}
            </p>
          )}
          {message.action.operations.map((op, opIdx) => {
            if (op.type === "CREATE_TRANSACTIONS") {
              const txOp = op as CreateTransactionsOp;
              return txOp.transactions.map((tx, txIdx) => {
                const idx = txOverrideIndex++;
                const override = message.action!.overrides?.[idx];
                return (
                  <TxConfirmCard
                    key={`${opIdx}-${txIdx}`}
                    tx={tx}
                    override={override}
                    accounts={accounts}
                    onUpdateOverride={(patch) => onUpdateOverride(message.action!.id, idx, patch)}
                    t={t}
                    locale={locale}
                  />
                );
              });
            }
            return (
              <OperationConfirmCard
                key={opIdx}
                op={op}
                t={t}
                locale={locale}
              />
            );
          })}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onConfirm(message.action!.id)}
              className="flex h-9 items-center gap-2 rounded-lg bg-[rgb(var(--foreground))] px-4 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 active:scale-[0.98]"
            >
              <CheckIcon size={12} weight="bold" />
              {message.action.operations.length > 1 ? t("chat.confirmAll") : t("chat.confirmAndSave")}
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

      {/* Confirmed */}
      {message.confirmed && message.savedOperations && message.savedOperations.length > 0 && (
        <div className="space-y-1.5">
          {message.savedOperations.map((op, i) => (
            <OperationSavedCard key={i} op={op} t={t} locale={locale} />
          ))}
        </div>
      )}

      {/* Rejected */}
      {message.rejected && (
        <div className="flex items-center gap-2 rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] px-4 py-2.5 text-sm text-[rgb(var(--muted))]">
          <XIcon size={13} />
          {locale === "ru" ? "Отклонено" : "Rejected"}
        </div>
      )}
    </div>
  );
}

// ─── Editable Transaction Confirm Card ───────────────────────────────────────

const COMMON_CURRENCIES = ["USD", "EUR", "RUB", "GBP", "AED", "CNY", "JPY", "TRY", "KZT", "UAH", "BTC", "ETH"];

function TxConfirmCard({
  tx,
  override,
  accounts,
  onUpdateOverride,
  t,
  locale,
}: {
  tx: ParsedTransaction;
  override?: TransactionOverride;
  accounts: { id: string; name: string; currency: string }[];
  onUpdateOverride: (patch: Partial<TransactionOverride>) => void;
  t: (key: string) => string;
  locale: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [accountEquivalent, setAccountEquivalent] = useState<string | null>(null);

  const effectiveAmount = override?.amount ?? tx.amount;
  const effectiveCurrency = override?.currency ?? tx.currency;
  const effectiveDate = override?.date ?? tx.date;
  const effectiveAccountId = override?.accountId ?? accounts[0]?.id;

  const selectedAccount = accounts.find((a) => a.id === effectiveAccountId) ?? accounts[0];
  const isForeignCurrency = !!(selectedAccount && effectiveCurrency !== selectedAccount.currency);

  // Fetch account-currency equivalent for cross-currency transactions
  useEffect(() => {
    if (!isForeignCurrency || !selectedAccount) return;
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/exchange-rates?base=${effectiveCurrency}`)
      .then((r) => r.json())
      .then((res: { rates: Record<string, number> }) => {
        if (cancelled) return;
        const rate = res.rates?.[selectedAccount.currency];
        setAccountEquivalent(rate ? (effectiveAmount * rate).toFixed(2) : null);
      })
      .catch(() => { if (!cancelled) setAccountEquivalent(null); });
    return () => { cancelled = true; };
  }, [effectiveAmount, effectiveCurrency, effectiveAccountId, isForeignCurrency, selectedAccount]);

  const isExpense = tx.type === "EXPENSE";
  const isIncome = tx.type === "INCOME";

  const amountColor = isExpense
    ? "text-[rgb(var(--negative))]"
    : isIncome
      ? "text-[rgb(var(--positive))]"
      : "text-[rgb(var(--foreground))]";

  const badgeBg = isExpense
    ? "bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))]"
    : isIncome
      ? "bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]"
      : "bg-[rgb(var(--surface-soft))] text-[rgb(var(--muted))]";

  const typeLabel = isExpense
    ? t("transactions.expense")
    : isIncome
      ? t("transactions.income")
      : t("transactions.transfer");

  const sign = isExpense ? "−" : isIncome ? "+" : "";

  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      {/* Main row */}
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className={["text-lg font-semibold tabular-nums leading-tight", amountColor].join(" ")}>
            {sign}
            {effectiveAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            {effectiveCurrency}
          </div>
          {isForeignCurrency && accountEquivalent && (
            <div className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              ≈ {accountEquivalent} {selectedAccount?.currency}
            </div>
          )}
          {(tx.merchant || tx.counterparty) && (
            <div className="mt-0.5 text-sm font-medium text-[rgb(var(--foreground))]">
              {tx.merchant || tx.counterparty}
            </div>
          )}
          {tx.categoryName && (
            <div className="text-xs text-[rgb(var(--muted))]">{tx.categoryName}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={["rounded-full px-2.5 py-0.5 text-xs font-medium", badgeBg].join(" ")}>
            {typeLabel}
          </span>
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
            title={locale === "ru" ? "Редактировать" : "Edit"}
          >
            <PencilSimpleIcon size={13} weight="bold" />
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 border-t border-[rgb(var(--border-soft))] px-4 py-2 text-[11px] text-[rgb(var(--muted))]">
        {effectiveDate && <span>{formatDate(effectiveDate, locale)}</span>}
        {selectedAccount && (
          <>
            <span className="opacity-40">·</span>
            <span className="flex items-center gap-1">
              <BankIcon size={10} />
              {selectedAccount.name}
            </span>
          </>
        )}
        <span className="opacity-40">·</span>
        <span>{Math.round(tx.confidence * 100)}% {t("chat.confidence")}</span>
      </div>

      {/* Edit panel */}
      {isEditing && (
        <div className="border-t border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                {t("transactions.amount")}
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={override?.amount ?? tx.amount}
                onChange={(e) => onUpdateOverride({ amount: parseFloat(e.target.value) || tx.amount })}
                className="h-8 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                {locale === "ru" ? "Валюта" : "Currency"}
              </label>
              <select
                value={override?.currency ?? tx.currency}
                onChange={(e) => onUpdateOverride({ currency: e.target.value })}
                className="h-8 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              >
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                {!COMMON_CURRENCIES.includes(tx.currency) && (
                  <option value={tx.currency}>{tx.currency}</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                {t("transactions.dateLabel")}
              </label>
              <input
                type="date"
                value={(override?.date ?? tx.date).slice(0, 10)}
                onChange={(e) => onUpdateOverride({ date: e.target.value })}
                className="h-8 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              />
            </div>
            {accounts.length > 0 && (
              <AccountPicker
                accounts={accounts}
                value={effectiveAccountId ?? undefined}
                onChange={(id) => onUpdateOverride({ accountId: id })}
                label={tx.type === "TRANSFER"
                  ? (locale === "ru" ? "Счёт (откуда)" : "From account")
                  : (locale === "ru" ? "Счёт" : "Account")}
              />
            )}
          </div>

          {tx.type === "TRANSFER" && accounts.length > 1 && (
            <AccountPicker
              accounts={accounts.filter((a) => a.id !== effectiveAccountId)}
              value={override?.toAccountId ?? undefined}
              onChange={(id) => onUpdateOverride({ toAccountId: id })}
              label={locale === "ru" ? "Счёт (куда)" : "To account"}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Other confirm cards ──────────────────────────────────────────────────────

function OperationConfirmCard({
  op,
  t,
  locale,
}: {
  op: AiOperation;
  t: (key: string) => string;
  locale: string;
}) {
  switch (op.type) {
    case "CREATE_ACCOUNT":
      return <AccountConfirmCard op={op as CreateAccountOp} t={t} />;
    case "CREATE_CATEGORIES":
      return <CategoriesConfirmCard op={op as CreateCategoriesOp} t={t} />;
    case "SET_BUDGET":
      return <BudgetConfirmCard op={op as SetBudgetOp} t={t} locale={locale} />;
    case "CREATE_GOAL":
      return <GoalConfirmCard op={op as CreateGoalOp} t={t} locale={locale} />;
    default:
      return null;
  }
}

function OperationSavedCard({
  op,
  t,
  locale,
}: {
  op: AiOperation;
  t: (key: string) => string;
  locale: string;
}) {
  switch (op.type) {
    case "CREATE_TRANSACTIONS":
      return (
        <>
          {(op as CreateTransactionsOp).transactions.map((tx, i) => (
            <TxSavedCard key={i} tx={tx} t={t} locale={locale} />
          ))}
        </>
      );
    case "CREATE_ACCOUNT":
      return <SimpleSavedCard icon={<BankIcon size={10} weight="bold" />} label={t("chat.accountSaved")} detail={(op as CreateAccountOp).name} />;
    case "CREATE_CATEGORIES":
      return (
        <SimpleSavedCard
          icon={<FolderIcon size={10} weight="bold" />}
          label={t("chat.categoriesSaved")}
          detail={(op as CreateCategoriesOp).categories.map((c) => c.name).join(", ")}
        />
      );
    case "SET_BUDGET":
      return (
        <SimpleSavedCard
          icon={<SlidersIcon size={10} weight="bold" />}
          label={t("chat.budgetSaved")}
          detail={`${(op as SetBudgetOp).categoryName} · ${(op as SetBudgetOp).amount.toLocaleString()} ${(op as SetBudgetOp).currency}`}
        />
      );
    case "CREATE_GOAL":
      return (
        <SimpleSavedCard
          icon={<TargetIcon size={10} weight="bold" />}
          label={t("chat.goalSaved")}
          detail={(op as CreateGoalOp).name}
        />
      );
    default:
      return null;
  }
}

// ─── Individual card components ───────────────────────────────────────────────

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function AccountConfirmCard({ op, t }: { op: CreateAccountOp; t: (key: string) => string }) {
  const typeLabel: Record<string, string> = {
    CASH: "Cash", CARD: "Card", BANK: "Bank", WISE: "Wise", PAYPAL: "PayPal", CRYPTO: "Crypto", OTHER: "Other",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-soft))]">
          <BankIcon size={16} className="text-[rgb(var(--muted))]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[rgb(var(--foreground))]">{op.name}</div>
          <div className="text-xs text-[rgb(var(--muted))]">
            {typeLabel[op.accountType] ?? op.accountType} · {op.currency}
            {op.isDebt && <span className="ml-1.5 text-[rgb(var(--negative))]">({t("chat.debtAccount")})</span>}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[rgb(var(--surface-soft))] px-2.5 py-0.5 text-xs font-medium text-[rgb(var(--muted))]">
          {t("chat.createAccount")}
        </span>
      </div>
      {op.initialBalance !== 0 && (
        <div className="border-t border-[rgb(var(--border-soft))] px-4 py-2 text-[11px] text-[rgb(var(--muted))]">
          {t("chat.initialBalance")}: {op.initialBalance.toLocaleString()} {op.currency}
        </div>
      )}
    </div>
  );
}

function CategoriesConfirmCard({ op, t }: { op: CreateCategoriesOp; t: (key: string) => string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-soft))]">
          <FolderIcon size={16} className="text-[rgb(var(--muted))]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[rgb(var(--foreground))]">
            {op.categories.length === 1
              ? op.categories[0].name
              : `${op.categories.length} ${t("chat.createCategories").toLowerCase()}`}
          </div>
          <div className="text-xs text-[rgb(var(--muted))]">
            {op.categories.map((c) => `${c.icon ? c.icon + " " : ""}${c.name}`).join(", ")}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[rgb(var(--surface-soft))] px-2.5 py-0.5 text-xs font-medium text-[rgb(var(--muted))]">
          {t("chat.createCategories")}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border-soft))] px-4 py-2">
        {op.categories.map((c, i) => (
          <span
            key={i}
            className={[
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              c.categoryType === "EXPENSE"
                ? "bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))]"
                : "bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]",
            ].join(" ")}
          >
            {c.icon ? `${c.icon} ` : ""}{c.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function BudgetConfirmCard({ op, t, locale }: { op: SetBudgetOp; t: (key: string) => string; locale: string }) {
  const periodLabel: Record<string, string> =
    locale === "ru"
      ? { MONTHLY: "ежемесячно", QUARTERLY: "ежеквартально", YEARLY: "ежегодно" }
      : { MONTHLY: "monthly", QUARTERLY: "quarterly", YEARLY: "yearly" };

  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-soft))]">
          <SlidersIcon size={16} className="text-[rgb(var(--muted))]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[rgb(var(--foreground))]">
            {op.amount.toLocaleString()} {op.currency}
          </div>
          <div className="text-xs text-[rgb(var(--muted))]">
            {t("chat.budgetFor")} {op.categoryName} · {periodLabel[op.period] ?? op.period}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[rgb(var(--surface-soft))] px-2.5 py-0.5 text-xs font-medium text-[rgb(var(--muted))]">
          {t("chat.setBudget")}
        </span>
      </div>
    </div>
  );
}

function GoalConfirmCard({ op, t, locale }: { op: CreateGoalOp; t: (key: string) => string; locale: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-soft))]">
          <TargetIcon size={16} className="text-[rgb(var(--muted))]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[rgb(var(--foreground))]">{op.name}</div>
          <div className="text-xs text-[rgb(var(--muted))]">
            {t("chat.targetAmount")}: {op.targetAmount.toLocaleString()} {op.currency}
            {op.deadline && <span className="ml-2">· {formatDate(op.deadline, locale)}</span>}
            {!op.deadline && <span className="ml-2">· {t("chat.noDeadline")}</span>}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[rgb(var(--surface-soft))] px-2.5 py-0.5 text-xs font-medium text-[rgb(var(--muted))]">
          {t("chat.createGoal")}
        </span>
      </div>
    </div>
  );
}

function TxSavedCard({
  tx,
  t,
  locale,
}: {
  tx: ParsedTransaction;
  t: (key: string) => string;
  locale: string;
}) {
  const isExpense = tx.type === "EXPENSE";
  const isIncome = tx.type === "INCOME";
  const sign = isExpense ? "−" : isIncome ? "+" : "";
  const amountColor = isExpense
    ? "text-[rgb(var(--negative))]"
    : isIncome
      ? "text-[rgb(var(--positive))]"
      : "text-[rgb(var(--foreground))]";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] px-4 py-2.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--positive))]">
        <CheckIcon size={10} weight="bold" className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={["text-sm font-semibold tabular-nums", amountColor].join(" ")}>
          {sign}
          {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
          {tx.currency}
        </div>
        <div className="truncate text-[11px] text-[rgb(var(--muted))]">
          {[
            tx.merchant || tx.counterparty,
            tx.categoryName,
            tx.date ? formatDate(tx.date, locale) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <span className="shrink-0 text-xs font-medium text-[rgb(var(--positive))]">
        {t("chat.saved")}
      </span>
    </div>
  );
}

function SimpleSavedCard({
  icon,
  label,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] px-4 py-2.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--positive))]">
        <span className="text-white">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[rgb(var(--foreground))]">{detail}</div>
      </div>
      <span className="shrink-0 text-xs font-medium text-[rgb(var(--positive))]">{label}</span>
    </div>
  );
}
