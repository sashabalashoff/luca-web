"use client";

import { apiFetch, getAuthToken } from "@/shared/api/client";
import type {
  AiOperation,
  AnswerPayload,
  CreateAccountOp,
  CreateCategoriesOp,
  CreateGoalOp,
  CreateTransactionsOp,
  DeleteTransactionsOp,
  ParsedTransaction,
  SetBudgetOp,
  UpdateGoalProgressOp,
  UpdateTransactionOp,
} from "@/shared/api/types";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { AccountPicker } from "@/shared/ui/account-picker";
import {
  ArrowClockwiseIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BankIcon,
  CameraIcon,
  CheckIcon,
  CopyIcon,
  FolderIcon,
  MicrophoneIcon,
  PencilSimpleIcon,
  ShareNetworkIcon,
  SlidersIcon,
  StopCircleIcon,
  TargetIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type StatementSummary = {
  count: number;
  periodFrom: string | null;
  periodTo: string | null;
  accountName: string | null;
  totalIncome: number;
  totalExpenses: number;
  currency: string;
};

type ThinkingStep = {
  tool: string;
  phase: "pending" | "done";
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: ChatAction | null;
  confirmed?: boolean;
  confirmedActionId?: string;
  rejected?: boolean;
  saving?: boolean;
  streaming?: boolean;
  savedOperations?: AiOperation[];
  thinkingSteps?: ThinkingStep[];
  displayType?: string;
  answerPayload?: AnswerPayload | null;
  feedback?: "UP" | "DOWN";
  importSummary?: StatementSummary | null;
  saveProgress?: { done: number; total: number } | null;
  saveProgressStopped?: { done: number; total: number } | null;
};

const INTRO_ID = "intro";

const EXAMPLE_PROMPTS_EN = [
  "Show my cash flow for this month",
  "Which categories are over budget?",
  "Export my recent business expenses",
];
const EXAMPLE_PROMPTS_RU = [
  "Покажи cash flow за этот месяц",
  "Какие категории вышли за бюджет?",
  "Покажи последние бизнес-расходы",
];

function extractOperations(payloadJson: Record<string, unknown>): AiOperation[] {
  if (Array.isArray(payloadJson.operations) && payloadJson.operations.length > 0) {
    return payloadJson.operations as AiOperation[];
  }
  if (Array.isArray(payloadJson.transactions) && payloadJson.transactions.length > 0) {
    return [{ type: "CREATE_TRANSACTIONS", transactions: payloadJson.transactions }] as AiOperation[];
  }
  return [];
}

// ─── Category type (minimal, for picker) ─────────────────────────────────────

type ChatCategory = { id: string; name: string; type: string };

// ─── Main component ───────────────────────────────────────────────────────────

export function ChatPageClient() {
  const { t, locale } = useI18n();
  const { workspace, accounts, defaultAccount, isLoading, reload } = useLuca();
  const [categories, setCategories] = useState<ChatCategory[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s");

  const [messages, setMessages] = useState<Message[]>([
    { id: INTRO_ID, role: "assistant", content: t("chat.intro") },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isReceiptScanning, setIsReceiptScanning] = useState(false);
  const [isStatementImporting, setIsStatementImporting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    apiFetch<{ categories: ChatCategory[] }>(`/api/categories?workspaceId=${workspace.id}`)
      .then((r) => setCategories(r.categories))
      .catch(() => { });
  }, [workspace]);

  const sessionWasCreatedByUs = useRef(new Set<string>());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const importAbortRef = useRef<AbortController | null>(null);
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
      if (e.key.length !== 1) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      textareaRef.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // When sessionId disappears (user starts new chat), reset to intro
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
        answerPayload?: AnswerPayload | null;
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
            answerPayload: msg.answerPayload ?? null,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, workspace?.id]);

  function growTextarea(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
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
      ...prev.filter((m) => m.id !== INTRO_ID),
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

          if (eventType === "thinking") {
            const tool = payload.tool as string;
            const phase = payload.phase as "tool_start" | "tool_done";
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const steps = m.thinkingSteps ?? [];
                if (phase === "tool_start") {
                  return { ...m, thinkingSteps: [...steps, { tool, phase: "pending" }] };
                } else {
                  return {
                    ...m,
                    thinkingSteps: steps.map((s) =>
                      s.tool === tool && s.phase === "pending" ? { ...s, phase: "done" } : s
                    ),
                  };
                }
              })
            );
          } else if (eventType === "text") {
            const delta = payload.delta as string;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + delta } : m
              )
            );
          } else if (eventType === "action") {
            const actionId = payload.actionId as string;
            const operations = (payload.operations as AiOperation[]) ?? [];
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
            const displayType = payload.displayType as string | undefined;
            const answerPayload = payload.answerPayload as AnswerPayload | null | undefined;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, streaming: false, content: finalMessage ?? m.content, displayType, answerPayload }
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

  async function scanReceipt(file: File) {
    if (!workspace || isReceiptScanning) return;
    setIsReceiptScanning(true);

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev.filter((m) => m.id !== INTRO_ID),
      { id: userMsgId, role: "user", content: `📷 ${file.name}` },
      { id: assistantMsgId, role: "assistant", content: "", streaming: true },
    ]);

    try {
      const token = await getAuthToken();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("workspaceId", workspace.id);
      fd.append("locale", locale);
      if (sessionId) fd.append("sessionId", sessionId);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/receipt`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        actionId: string | null;
        operations: AiOperation[];
        message: string;
      };

      if (!data.actionId || !data.operations?.length) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: t("chat.receiptNoTransactions"), streaming: false }
              : m
          )
        );
        return;
      }

      const overrides = buildInitialOverrides(data.operations, accounts, defaultAccount?.id);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
              ...m,
              content: data.message,
              streaming: false,
              action: { id: data.actionId!, status: "PENDING", operations: data.operations, overrides },
            }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: t("chat.receiptError"), streaming: false }
            : m
        )
      );
    } finally {
      setIsReceiptScanning(false);
    }
  }

  async function importStatement(file: File) {
    if (!workspace || isStatementImporting) return;
    setIsStatementImporting(true);

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev.filter((m) => m.id !== INTRO_ID),
      { id: userMsgId, role: "user", content: `📄 ${file.name}` },
      { id: assistantMsgId, role: "assistant", content: "", streaming: true },
    ]);

    try {
      const token = await getAuthToken();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("workspaceId", workspace.id);
      fd.append("locale", locale);
      if (sessionId) fd.append("sessionId", sessionId);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/import-statement`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: err.error?.message ?? (locale === "ru" ? "Не удалось прочитать выписку." : "Failed to read the statement."), streaming: false }
              : m
          )
        );
        return;
      }

      const data = await res.json() as {
        actionId: string | null;
        operations: AiOperation[];
        summary: StatementSummary;
        message: string;
      };

      if (!data.actionId || !data.operations?.length) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: locale === "ru" ? "Транзакции в выписке не найдены." : "No transactions found in the statement.", streaming: false }
              : m
          )
        );
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
              ...m,
              content: "",
              streaming: false,
              action: { id: data.actionId!, status: "PENDING", operations: data.operations },
              importSummary: data.summary,
            }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: locale === "ru" ? "Ошибка при загрузке выписки." : "Error importing statement.", streaming: false }
            : m
        )
      );
    } finally {
      setIsStatementImporting(false);
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

    // Merge overrides into savedOperations so TxSavedCard shows the confirmed values
    let overrideIdx = 0;
    const savedOperations: AiOperation[] = operations.map((op) => {
      if (op.type !== "CREATE_TRANSACTIONS") return op;
      return {
        ...op,
        transactions: (op as CreateTransactionsOp).transactions.map((tx) => {
          const ov = overrides[overrideIdx++];
          if (!ov) return tx;
          return {
            ...tx,
            ...(ov.amount !== undefined && { amount: ov.amount }),
            ...(ov.currency !== undefined && { currency: ov.currency }),
            ...(ov.merchant !== undefined && { merchant: ov.merchant }),
            ...(ov.date !== undefined && { date: ov.date }),
            ...(ov.comment !== undefined && { comment: ov.comment }),
          };
        }),
      };
    });

    // Show saving spinner while API call is in progress (keep action visible)
    setMessages((prev) =>
      prev.map((m) => m.action?.id === actionId ? { ...m, saving: true } : m)
    );

    // Use streaming endpoint for statement imports so we can show progress
    if (msg?.importSummary) {
      const controller = new AbortController();
      importAbortRef.current = controller;
      let lastProgress: { done: number; total: number } | null = null;

      try {
        const token = await getAuthToken();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/ai/actions/${actionId}/confirm-stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ accountId: defaultAccount?.id ?? null }),
            signal: controller.signal,
          }
        );

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
            if (!part.startsWith("data:")) continue;
            const dataStr = part.slice(5).trim();
            let evt: Record<string, unknown>;
            try { evt = JSON.parse(dataStr); } catch { continue; }

            if (evt.error) throw new Error(String(evt.error));

            const done2 = evt.done as number | undefined;
            const total = evt.total as number | undefined;
            if (done2 !== undefined && total !== undefined) {
              lastProgress = { done: done2, total };
              setMessages((prev) =>
                prev.map((m) =>
                  m.action?.id === actionId
                    ? { ...m, saveProgress: { done: done2, total } }
                    : m
                )
              );
            }

            if (evt.finished) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.action?.id === actionId
                    ? { ...m, confirmed: true, confirmedActionId: actionId, saving: false, saveProgress: null, action: null, savedOperations }
                    : m
                )
              );
              reload();
            }
          }
        }
      } catch (err) {
        const wasAborted = err instanceof Error && err.name === "AbortError";
        if (wasAborted && lastProgress) {
          setMessages((prev) =>
            prev.map((m) =>
              m.action?.id === actionId
                ? { ...m, confirmed: true, confirmedActionId: actionId, saving: false, saveProgress: null, saveProgressStopped: lastProgress, action: null, savedOperations: [] }
                : m
            )
          );
          reload();
        } else {
          console.error(err);
          setMessages((prev) =>
            prev.map((m) => m.action?.id === actionId ? { ...m, saving: false, saveProgress: null } : m)
          );
        }
      } finally {
        importAbortRef.current = null;
      }
      return;
    }

    try {
      await apiFetch(`/api/ai/actions/${actionId}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          accountId: defaultAccount?.id ?? null,
          transactionOverrides: overrides,
        }),
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.action?.id === actionId
            ? { ...m, confirmed: true, confirmedActionId: actionId, saving: false, action: null, savedOperations }
            : m
        )
      );
      reload();
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) => m.action?.id === actionId ? { ...m, saving: false } : m)
      );
    }
  }

  async function sendFeedback(messageId: string, rating: "UP" | "DOWN") {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, feedback: rating } as Message : m))
    );
    try {
      await apiFetch("/api/ai/chat/feedback", {
        method: "POST",
        body: JSON.stringify({ messageId, rating }),
      });
    } catch (err) {
      console.error(err);
    }
  }

  function retryAssistantMessage(messageId: string) {
    const idx = messages.findIndex((m) => m.id === messageId);
    const previousUser = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (previousUser) void sendMessage(previousUser.content);
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

    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
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

  function stopImport() {
    importAbortRef.current?.abort();
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
      {/* ── Message area ── */}
      {historyLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <ThinkingIndicator label={t("common.loading")} />
        </div>
      ) : !hasUserMessages ? (
        /* ── Welcome screen ── */
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-4">
          <div className="w-full max-w-xl">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">
                {t("chat.welcome")}
              </h2>
              <p className="text-sm text-[rgb(var(--muted))]">{t("chat.subtitle")}</p>
            </div>

            {/* Input in welcome state */}
            <ChatInput
              textareaRef={textareaRef}
              fileInputRef={fileInputRef}
              pdfInputRef={pdfInputRef}
              input={input}
              setInput={setInput}
              isSending={isSending}
              isLoading={isLoading}
              isRecording={isRecording}
              isReceiptScanning={isReceiptScanning}
              isStatementImporting={isStatementImporting}
              onSend={() => sendMessage()}
              onToggleRecording={toggleRecording}
              onReceiptFile={scanReceipt}
              onStatementFile={importStatement}
              onGrow={growTextarea}
              t={t}
            />

            {/* Suggestion chips */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {(locale === "ru" ? EXAMPLE_PROMPTS_RU : EXAMPLE_PROMPTS_EN).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={isSending || isLoading}
                  className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3.5 py-1.5 text-xs text-[rgb(var(--muted))] transition hover:border-[rgb(var(--border-soft))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── Conversation ── */
        <div className="flex-1 overflow-y-auto thin-scrollbar">
          <div className="mx-auto max-w-3xl space-y-5 px-3 py-6 sm:px-4 lg:px-6">
            {messages
              .filter((m) => m.id !== INTRO_ID)
              .map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  accounts={accounts}
                  categories={categories}
                  onConfirm={confirmAction}
                  onReject={rejectAction}
                  onStop={stopImport}
                  onUpdateOverride={updateOverride}
                  onFeedback={sendFeedback}
                  onRetry={retryAssistantMessage}
                  t={t}
                  locale={locale}
                />
              ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* ── Input bar (conversation mode) ── */}
      {hasUserMessages && (
        <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-3xl px-3 py-3 sm:px-4 lg:px-6">
            <ChatInput
              textareaRef={textareaRef}
              fileInputRef={fileInputRef}
              pdfInputRef={pdfInputRef}
              input={input}
              setInput={setInput}
              isSending={isSending}
              isLoading={isLoading}
              isRecording={isRecording}
              isReceiptScanning={isReceiptScanning}
              isStatementImporting={isStatementImporting}
              onSend={() => sendMessage()}
              onToggleRecording={toggleRecording}
              onReceiptFile={scanReceipt}
              onStatementFile={importStatement}
              onGrow={growTextarea}
              t={t}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chat input ───────────────────────────────────────────────────────────────

function ChatInput({
  textareaRef,
  fileInputRef,
  pdfInputRef,
  input,
  setInput,
  isSending,
  isLoading,
  isRecording,
  isReceiptScanning,
  isStatementImporting,
  onSend,
  onToggleRecording,
  onReceiptFile,
  onStatementFile,
  onGrow,
  t,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  pdfInputRef: React.RefObject<HTMLInputElement | null>;
  input: string;
  setInput: (v: string) => void;
  isSending: boolean;
  isLoading: boolean;
  isRecording: boolean;
  isReceiptScanning: boolean;
  isStatementImporting: boolean;
  onSend: () => void;
  onToggleRecording: () => void;
  onReceiptFile: (file: File) => void;
  onStatementFile: (file: File) => void;
  onGrow: (el: HTMLTextAreaElement) => void;
  t: (key: string) => string;
}) {
  const busy = isSending || isReceiptScanning || isStatementImporting;

  return (
    <div
      className={[
        "flex items-end gap-2 rounded-lg border bg-[rgb(var(--surface))] px-3 py-2 shadow-sm transition-colors sm:px-4",
        isRecording
          ? "border-[rgb(var(--negative))]"
          : "border-[rgb(var(--border))] focus-within:border-[rgb(var(--accent))]",
      ].join(" ")}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onReceiptFile(file);
            e.target.value = "";
          }
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onStatementFile(file);
            e.target.value = "";
          }
        }}
      />

      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          onGrow(e.target);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={isRecording ? t("chat.listening") : isReceiptScanning ? t("chat.scanning") : t("chat.placeholder")}
        rows={1}
        className="flex-1 resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-[rgb(var(--muted))] sm:text-sm"
        style={{ minHeight: "28px", maxHeight: "160px" }}
      />

      <div className="flex shrink-0 items-center gap-1 pb-0.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || isLoading}
          title={t("chat.scanReceipt")}
          className={[
            "flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:h-9 sm:w-9",
            isReceiptScanning
              ? "text-[rgb(var(--accent))] animate-pulse"
              : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
          ].join(" ")}
        >
          <CameraIcon size={18} weight="regular" />
        </button>

        <button
          type="button"
          onClick={() => pdfInputRef.current?.click()}
          disabled={busy || isLoading}
          title={t("chat.importStatement")}
          className={[
            "flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:h-9 sm:w-9",
            isStatementImporting
              ? "text-[rgb(var(--accent))] animate-pulse"
              : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
          ].join(" ")}
        >
          <BankIcon size={18} weight="regular" />
        </button>

        <button
          type="button"
          onClick={onToggleRecording}
          disabled={busy || isLoading}
          title={isRecording ? t("chat.stopRecording") : t("chat.startRecording")}
          className={[
            "flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:h-9 sm:w-9",
            isRecording
              ? "bg-[rgb(var(--negative))] text-white"
              : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
          ].join(" ")}
        >
          {isRecording ? (
            <StopCircleIcon size={18} weight="fill" />
          ) : (
            <MicrophoneIcon size={18} weight="regular" />
          )}
        </button>

        <button
          onClick={onSend}
          disabled={busy || !input.trim() || isLoading}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--foreground))] text-[rgb(var(--background))] transition hover:opacity-80 disabled:opacity-20 active:scale-95 sm:h-9 sm:w-9"
          title={t("chat.enterHint")}
        >
          {busy ? (
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="block h-1 w-1 animate-bounce rounded-full bg-current"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
          ) : (
            <ArrowUpIcon size={15} weight="bold" />
          )}
        </button>
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

// ─── Thinking indicator (generic dots) ───────────────────────────────────────

function ThinkingIndicator({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[rgb(var(--muted))]">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-1.5 w-1.5 animate-bounce rounded-full bg-current"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      {label && <span className="text-xs">{label}</span>}
    </div>
  );
}

// ─── Thinking process (tool steps) ───────────────────────────────────────────

function ThinkingProcess({
  steps,
  t,
  collapsed = false,
}: {
  steps: ThinkingStep[];
  t: (key: string) => string;
  collapsed?: boolean;
}) {
  if (collapsed) {
    // Compact chips row shown above the answer
    return (
      <div className="flex flex-wrap gap-1.5 pb-1">
        {steps.map((step, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2.5 py-0.5 text-[11px] text-[rgb(var(--muted))]"
          >
            <CheckIcon size={9} weight="bold" className="text-[rgb(var(--positive))]" />
            {t(`chat.tools.${step.tool}`) !== `chat.tools.${step.tool}`
              ? t(`chat.tools.${step.tool}`)
              : step.tool.replace(/_/g, " ")}
          </span>
        ))}
      </div>
    );
  }

  // Full animated list while waiting for the answer
  return (
    <div className="space-y-2 py-1">
      {steps.map((step, i) => {
        const label =
          t(`chat.tools.${step.tool}`) !== `chat.tools.${step.tool}`
            ? t(`chat.tools.${step.tool}`)
            : step.tool.replace(/_/g, " ");
        const isDone = step.phase === "done";
        const isLast = i === steps.length - 1;

        return (
          <div key={i} className="flex items-center gap-2.5">
            {/* Icon */}
            <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
              {isDone ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[rgb(var(--positive))]/15">
                  <CheckIcon size={9} weight="bold" className="text-[rgb(var(--positive))]" />
                </span>
              ) : (
                <span className="flex h-4 w-4 items-center justify-center">
                  {/* Spinning ring for active step */}
                  <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgb(var(--border))] border-t-[rgb(var(--accent))]" />
                </span>
              )}
              {/* Vertical connector line */}
              {!isLast && (
                <span className="absolute left-1/2 top-5 h-2 w-px -translate-x-1/2 bg-[rgb(var(--border))]" />
              )}
            </div>

            {/* Label */}
            <span
              className={[
                "text-xs transition-colors",
                isDone
                  ? "text-[rgb(var(--muted))] line-through"
                  : "font-medium text-[rgb(var(--foreground))]",
              ].join(" ")}
            >
              {label}
              {!isDone && (
                <span className="ml-1 inline-flex gap-0.5">
                  {[0, 1, 2].map((j) => (
                    <span
                      key={j}
                      className="inline-block h-0.5 w-0.5 animate-bounce rounded-full bg-[rgb(var(--accent))]"
                      style={{ animationDelay: `${j * 150}ms` }}
                    />
                  ))}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── DisplayType rich blocks ──────────────────────────────────────────────────

type BudgetItem = {
  id: string;
  amount: string;
  currency: string;
  spent?: number;
  category?: { name: string; icon?: string | null } | null;
};

type GoalItem = {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  status: string;
  deadline?: string | null;
};

type CategoryStat = { name: string; amount: number; icon?: string | null };

type TxItem = {
  id: string;
  type: string;
  amount: string;
  currency: string;
  merchant?: string | null;
  date: string;
  category?: { name: string } | null;
};

function DisplayTypeBlock({
  displayType,
  answerPayload,
  t,
  locale,
}: {
  displayType: string;
  answerPayload?: AnswerPayload | null;
  t: (k: string) => string;
  locale: string;
}) {
  const { workspace } = useLuca();
  if (answerPayload?.widgets?.length) return <AnswerPayloadBlock payload={answerPayload} t={t} locale={locale} />;
  if (!workspace) return null;
  if (displayType === "budget_cards") return <BudgetStatusBlock workspaceId={workspace.id} t={t} />;
  if (displayType === "goals_cards") return <GoalsStatusBlock workspaceId={workspace.id} t={t} />;
  if (displayType === "chart_bar" || displayType === "chart_line") return <SpendingChartBlock workspaceId={workspace.id} />;
  if (displayType === "table") return <RecentTxBlock workspaceId={workspace.id} locale={locale} />;
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function AnswerPayloadBlock({ payload, t, locale }: { payload: AnswerPayload; t: (k: string) => string; locale: string }) {
  return (
    <div className="space-y-2">
      {payload.widgets.map((widget, idx) => {
        if (widget.type === "transactions_table") {
          const data = asRecord(widget.data);
          const rows = asArray(data.transactions) as TxItem[];
          return <RecentTxList key={idx} txs={rows} locale={locale} />;
        }
        if (widget.type === "spending_chart" || widget.type === "cashflow_chart") {
          const rows = asArray(widget.data).map((item) => {
            const r = asRecord(item);
            return {
              name: String(r.group ?? r.month ?? r.merchant ?? ""),
              amount: Number.parseFloat(String(r.total ?? r.expenses ?? r.income ?? 0).replace(/,/g, "")) || 0,
            };
          }).filter((row) => row.name);
          return <InlineBarList key={idx} rows={rows} />;
        }
        if (widget.type === "budget_cards") {
          return <BudgetPayloadCards key={idx} rows={asArray(widget.data)} t={t} />;
        }
        if (widget.type === "goals_cards") {
          return <GoalPayloadCards key={idx} rows={asArray(widget.data)} />;
        }
        if (widget.type === "account_balances") {
          const rows = Array.isArray(widget.data)
            ? widget.data
            : Object.entries(asRecord(asRecord(widget.data).byType)).map(([account, balance]) => ({ account, balance }));
          return <AccountBalancePayload key={idx} rows={rows} />;
        }
        return null;
      })}
    </div>
  );
}

function InlineBarList({ rows }: { rows: Array<{ name: string; amount: number }> }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <div className="mt-1 rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] p-3">
      <div className="space-y-2">
        {rows.slice(0, 8).map((row) => (
          <div key={row.name}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="shrink-0 tabular-nums text-[rgb(var(--muted))]">{row.amount.toLocaleString()}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--border))]">
              <div className="h-full rounded-full bg-[rgb(var(--accent))]" style={{ width: `${Math.max(4, (row.amount / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentTxList({ txs, locale }: { txs: TxItem[]; locale: string }) {
  if (!txs.length) return null;
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  return (
    <div className="mt-1 overflow-hidden rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))]">
      {txs.slice(0, 8).map((tx, idx) => {
        const isIncome = tx.type === "INCOME";
        const amount = Number.parseFloat(String(tx.amount).replace(/,/g, ""));
        return (
          <div key={tx.id ?? idx} className="flex items-center gap-2 border-b border-[rgb(var(--border-soft))] px-3 py-2 last:border-0">
            <div className={["flex h-6 w-6 shrink-0 items-center justify-center rounded-full", isIncome ? "bg-[rgb(var(--positive))]/15" : "bg-[rgb(var(--negative))]/15"].join(" ")}>
              {isIncome ? <ArrowUpIcon size={10} className="text-[rgb(var(--positive))]" /> : <ArrowDownIcon size={10} className="text-[rgb(var(--negative))]" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{tx.merchant ?? tx.category?.name ?? tx.type}</p>
              <p className="text-[10px] text-[rgb(var(--muted))]">{new Date(tx.date).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}</p>
            </div>
            <span className={["text-xs font-medium tabular-nums", isIncome ? "text-[rgb(var(--positive))]" : ""].join(" ")}>
              {isIncome ? "+" : "-"}{tx.currency} {Number.isFinite(amount) ? amount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : tx.amount}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BudgetPayloadCards({ rows, t }: { rows: unknown[]; t: (k: string) => string }) {
  if (!rows.length) return null;
  return (
    <div className="mt-1 rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] p-3">
      <p className="mb-2 text-[11px] font-medium uppercase text-[rgb(var(--muted))]">{t("chat.budgetStatus")}</p>
      <div className="space-y-2">
        {rows.map((item, idx) => {
          const row = asRecord(item);
          const pct = Number(row.pctUsed ?? 0);
          return (
            <div key={idx}>
              <div className="flex items-center justify-between text-xs">
                <span>{String(row.category ?? "")}</span>
                <span className="text-[rgb(var(--muted))]">{String(row.spent ?? "0")} / {String(row.limit ?? "0")}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--border))]">
                <div className="h-full rounded-full bg-[rgb(var(--accent))]" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalPayloadCards({ rows }: { rows: unknown[] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-1 rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] p-3">
      <div className="space-y-2">
        {rows.map((item, idx) => {
          const row = asRecord(item);
          const pct = Number(row.pct ?? 0);
          return (
            <div key={idx}>
              <div className="flex items-center justify-between text-xs">
                <span>{String(row.name ?? "")}</span>
                <span className="text-[rgb(var(--muted))]">{String(row.current ?? "0")} / {String(row.target ?? "0")} {String(row.currency ?? "")}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--border))]">
                <div className="h-full rounded-full bg-[rgb(var(--positive))]" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountBalancePayload({ rows }: { rows: unknown[] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-1 overflow-hidden rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))]">
      {rows.map((item, idx) => {
        const row = asRecord(item);
        return (
          <div key={idx} className="flex items-center justify-between border-b border-[rgb(var(--border-soft))] px-3 py-2 text-xs last:border-0">
            <span>{String(row.account ?? row.name ?? "Account")}</span>
            <span className="font-medium tabular-nums">{String(row.balance ?? row.total ?? "")} {String(row.currency ?? "")}</span>
          </div>
        );
      })}
    </div>
  );
}

function BudgetStatusBlock({ workspaceId, t }: { workspaceId: string; t: (k: string) => string }) {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();

  useEffect(() => {
    apiFetch<{ budgets: BudgetItem[] }>(
      `/api/budget?workspaceId=${workspaceId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`
    )
      .then((r) => setBudgets(r.budgets))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <div className="text-xs text-[rgb(var(--muted))]">{t("common.loading") || "Loading…"}</div>;
  if (!budgets.length) return null;

  return (
    <div className="mt-1 rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">{t("chat.budgetStatus")}</p>
      <div className="space-y-2.5">
        {budgets.map((b) => {
          const limit = parseFloat(b.amount);
          const spent = b.spent ?? 0;
          const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
          const over = spent > limit;
          return (
            <div key={b.id}>
              <div className="flex items-center justify-between text-xs">
                <span>{b.category?.icon ? `${b.category.icon} ` : ""}{b.category?.name ?? t("budget.overall")}</span>
                <span className={over ? "text-[rgb(var(--negative))]" : "text-[rgb(var(--muted))]"}>
                  {spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {limit.toLocaleString(undefined, { maximumFractionDigits: 0 })} {b.currency}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--border))]">
                <div
                  className={["h-full rounded-full transition-all", over ? "bg-[rgb(var(--negative))]" : pct >= 80 ? "bg-amber-400" : "bg-[rgb(var(--positive))]"].join(" ")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalsStatusBlock({ workspaceId, t }: { workspaceId: string; t: (k: string) => string }) {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ goals: GoalItem[] }>(`/api/goals?workspaceId=${workspaceId}`)
      .then((r) => setGoals(r.goals.filter((g) => g.status === "ACTIVE")))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <div className="text-xs text-[rgb(var(--muted))]">{t("common.loading") || "Loading…"}</div>;
  if (!goals.length) return null;

  return (
    <div className="mt-1 rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">{t("chat.goalsProgress")}</p>
      <div className="space-y-2.5">
        {goals.map((g) => {
          const current = parseFloat(g.currentAmount);
          const target = parseFloat(g.targetAmount);
          const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
          return (
            <div key={g.id}>
              <div className="flex items-center justify-between text-xs">
                <span>{g.name}</span>
                <span className="text-[rgb(var(--muted))]">
                  {current.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {target.toLocaleString(undefined, { maximumFractionDigits: 0 })} {g.currency}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--border))]">
                <div
                  className="h-full rounded-full bg-[rgb(var(--accent))] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpendingChartBlock({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<CategoryStat[]>([]);
  const [currency, setCurrency] = useState("");
  const [loading, setLoading] = useState(true);
  const now = new Date();

  useEffect(() => {
    apiFetch<{ categoryBreakdown: CategoryStat[]; currency: string }>(
      `/api/reports/monthly-summary?workspaceId=${workspaceId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`
    )
      .then((r) => {
        setData(r.categoryBreakdown.slice(0, 8));
        setCurrency(r.currency);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return null;
  if (!data.length) return null;

  const max = Math.max(...data.map((d) => d.amount));

  return (
    <div className="mt-1 rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] p-3">
      <ResponsiveContainer width="100%" height={Math.max(80, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
          <XAxis type="number" hide domain={[0, max * 1.05]} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => [`${currency} ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, ""]}
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
          />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={`hsl(${210 + i * 25}, 70%, 55%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecentTxBlock({ workspaceId, locale }: { workspaceId: string; locale: string }) {
  const [txs, setTxs] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

  useEffect(() => {
    apiFetch<{ transactions: TxItem[] }>(`/api/transactions?workspaceId=${workspaceId}&limit=8`)
      .then((r) => setTxs(r.transactions))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return null;
  if (!txs.length) return null;

  return (
    <div className="mt-1 overflow-hidden rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))]">
      {txs.map((tx) => {
        const isIncome = tx.type === "INCOME";
        const amt = parseFloat(tx.amount);
        return (
          <div key={tx.id} className="flex items-center gap-2 border-b border-[rgb(var(--border-soft))] px-3 py-2 last:border-0">
            <div className={["flex h-6 w-6 shrink-0 items-center justify-center rounded-full", isIncome ? "bg-[rgb(var(--positive))]/15" : "bg-[rgb(var(--negative))]/15"].join(" ")}>
              {isIncome
                ? <ArrowUpIcon size={10} className="text-[rgb(var(--positive))]" />
                : <ArrowDownIcon size={10} className="text-[rgb(var(--negative))]" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{tx.merchant ?? tx.category?.name ?? tx.type}</p>
              <p className="text-[10px] text-[rgb(var(--muted))]">{new Date(tx.date).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}</p>
            </div>
            <span className={["text-xs font-medium tabular-nums", isIncome ? "text-[rgb(var(--positive))]" : ""].join(" ")}>
              {isIncome ? "+" : "-"}{tx.currency} {amt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Message row ──────────────────────────────────────────────────────────────

function MessageRow({
  message,
  accounts,
  categories,
  onConfirm,
  onReject,
  onStop,
  onUpdateOverride,
  onFeedback,
  onRetry,
  t,
  locale,
}: {
  message: Message;
  accounts: { id: string; name: string; currency: string }[];
  categories: ChatCategory[];
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onStop: () => void;
  onUpdateOverride: (actionId: string, txIndex: number, patch: Partial<TransactionOverride>) => void;
  onFeedback: (messageId: string, rating: "UP" | "DOWN") => void;
  onRetry: (messageId: string) => void;
  t: (key: string) => string;
  locale: string;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[rgb(var(--foreground))] px-4 py-2.5 text-sm leading-relaxed text-[rgb(var(--background))] sm:max-w-[72%]">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message — still waiting (no text and no tool steps yet)
  if (message.streaming && !message.content && !message.action && !message.thinkingSteps?.length) {
    return (
      <div className="flex items-start gap-3">
        <div className="flex min-h-[36px] items-center">
          <ThinkingIndicator label={t("chat.thinking")} />
        </div>
      </div>
    );
  }

  // Tool steps phase — show process list
  if (message.streaming && !message.content && !message.action && message.thinkingSteps?.length) {
    return (
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <ThinkingProcess steps={message.thinkingSteps} t={t} />
        </div>
      </div>
    );
  }

  let txOverrideIndex = 0;

  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-3">
        {message.thinkingSteps && message.thinkingSteps.length > 0 && (
          <ThinkingProcess
            steps={message.thinkingSteps}
            t={t}
            collapsed={!!message.content || !!message.action}
          />
        )}

        {message.content && (
          <div className="chat-md text-sm leading-relaxed text-[rgb(var(--foreground))]">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {message.streaming && (
              <span className="ml-0.5 inline-block h-[13px] w-[2px] animate-pulse bg-[rgb(var(--foreground))] align-middle" />
            )}
          </div>
        )}

        {/* DisplayType rich block — shown after streaming ends */}
        {!message.streaming && (message.answerPayload || message.displayType) && !message.action && !message.confirmed && !message.rejected &&
          (message.answerPayload || !["text", "confirm_transaction", "confirm_operation"].includes(message.displayType ?? "text")) && (
            <DisplayTypeBlock displayType={message.displayType ?? "text"} answerPayload={message.answerPayload} t={t} locale={locale} />
          )}

        {/* Bank statement import summary — single confirm card for bulk import */}
        {message.action && message.importSummary && (
          <StatementImportCard
            summary={message.importSummary}
            onConfirm={() => onConfirm(message.action!.id)}
            onReject={() => onReject(message.action!.id)}
            onStop={onStop}
            saving={!!message.saving}
            saveProgress={message.saveProgress ?? null}
            t={t}
          />
        )}

        {/* Pending confirmation */}
        {message.action && !message.importSummary && (
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
                      categories={categories}
                      onUpdateOverride={(patch) => onUpdateOverride(message.action!.id, idx, patch)}
                      t={t}
                      locale={locale}
                    />
                  );
                });
              }
              return (
                <OperationConfirmCard key={opIdx} op={op} t={t} locale={locale} />
              );
            })}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => !message.saving && onConfirm(message.action!.id)}
                disabled={!!message.saving}
                className="flex h-10 items-center gap-2 rounded-xl bg-[rgb(var(--foreground))] px-4 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:h-9"
              >
                {message.saving ? (
                  <ArrowClockwiseIcon size={12} className="animate-spin" />
                ) : (
                  <CheckIcon size={12} weight="bold" />
                )}
                {message.saving
                  ? (t("common.loading") || "Saving…")
                  : message.action.operations.length > 1 ? t("chat.confirmAll") : t("chat.confirmAndSave")}
              </button>
              <button
                onClick={() => onReject(message.action!.id)}
                disabled={!!message.saving}
                className="flex h-10 items-center gap-2 rounded-xl border border-[rgb(var(--border))] px-4 text-sm text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:h-9"
              >
                <XIcon size={12} />
                {t("chat.reject")}
              </button>
            </div>
          </div>
        )}

        {/* Confirmed — partial stop */}
        {message.confirmed && message.saveProgressStopped && message.importSummary && (
          <StatementStoppedCard
            progress={message.saveProgressStopped}
            summary={message.importSummary}
            t={t}
            locale={locale}
          />
        )}

        {/* Confirmed — full import */}
        {message.confirmed && !message.saveProgressStopped && message.savedOperations && message.savedOperations.length > 0 && (
          message.importSummary ? (
            <StatementSavedCard
              operations={message.savedOperations}
              summary={message.importSummary}
              t={t}
              locale={locale}
            />
          ) : (
            <div className="space-y-1.5">
              {message.savedOperations.map((op, i) => (
                <OperationSavedCard key={i} op={op} t={t} locale={locale} />
              ))}
            </div>
          )
        )}

        {/* Rejected */}
        {message.rejected && (
          <div className="flex items-center gap-2 rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
            <XIcon size={11} />
            {t("chat.rejected")}
          </div>
        )}

        {!message.streaming && message.content && (
          <MessageToolbar
            message={message}
            onFeedback={onFeedback}
            onRetry={onRetry}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

function MessageToolbar({
  message,
  onFeedback,
  onRetry,
  t,
}: {
  message: Message;
  onFeedback: (messageId: string, rating: "UP" | "DOWN") => void;
  onRetry: (messageId: string) => void;
  t: (key: string) => string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    await navigator.clipboard?.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function shareMessage() {
    if (navigator.share) {
      await navigator.share({ text: message.content });
      return;
    }
    await copyMessage();
  }

  const buttonClass =
    "flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]";

  return (
    <div className="flex items-center gap-1 pt-1 opacity-80">
      <button type="button" onClick={copyMessage} className={buttonClass} title={copied ? t("chat.copied") : t("chat.copy")}>
        <CopyIcon size={13} />
      </button>
      <button type="button" onClick={shareMessage} className={buttonClass} title={t("chat.share")}>
        <ShareNetworkIcon size={13} />
      </button>
      <button type="button" onClick={() => onRetry(message.id)} className={buttonClass} title={t("chat.retry")}>
        <ArrowClockwiseIcon size={13} />
      </button>
      <button
        type="button"
        onClick={() => onFeedback(message.id, "UP")}
        className={[buttonClass, message.feedback === "UP" ? "bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]" : ""].join(" ")}
        title={t("chat.goodResponse")}
      >
        <ThumbsUpIcon size={13} />
      </button>
      <button
        type="button"
        onClick={() => onFeedback(message.id, "DOWN")}
        className={[buttonClass, message.feedback === "DOWN" ? "bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))]" : ""].join(" ")}
        title={t("chat.badResponse")}
      >
        <ThumbsDownIcon size={13} />
      </button>
    </div>
  );
}

// ─── Editable Transaction Confirm Card ───────────────────────────────────────

const COMMON_CURRENCIES = ["USD", "EUR", "RUB", "GBP", "AED", "CNY", "JPY", "TRY", "KZT", "UAH", "BTC", "ETH"];

function TxConfirmCard({
  tx,
  override,
  accounts,
  categories,
  onUpdateOverride,
  t,
  locale,
}: {
  tx: ParsedTransaction;
  override?: TransactionOverride;
  accounts: { id: string; name: string; currency: string }[];
  categories: ChatCategory[];
  onUpdateOverride: (patch: Partial<TransactionOverride>) => void;
  t: (key: string) => string;
  locale: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [accountEquivalent, setAccountEquivalent] = useState<string | null>(null);

  const effectiveAmount = override?.amount ?? tx.amount;
  const effectiveCurrency = override?.currency ?? tx.currency;
  const effectiveDate = override?.date ?? tx.date;
  const effectiveAccountId = override?.accountId ?? accounts[0]?.id;

  const selectedAccount = accounts.find((a) => a.id === effectiveAccountId) ?? accounts[0];
  const isForeignCurrency = !!(selectedAccount && effectiveCurrency !== selectedAccount.currency);

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
          {tx.tags && tx.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tx.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[rgb(var(--surface-soft))] border border-[rgb(var(--border-soft))] px-2 py-0.5 text-[10px] text-[rgb(var(--muted))]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={["rounded-full px-2.5 py-0.5 text-xs font-medium", badgeBg].join(" ")}>
            {typeLabel}
          </span>
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
            title={t("common.edit")}
          >
            <PencilSimpleIcon size={13} weight="bold" />
          </button>
        </div>
      </div>

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
        {tx.items && tx.items.length > 0 && (
          <>
            <span className="opacity-40">·</span>
            <button
              type="button"
              onClick={() => setShowItems((v) => !v)}
              className="flex items-center gap-1 underline-offset-2 hover:underline"
            >
              {showItems ? t("chat.hideItems") : `${t("chat.showItems")} (${tx.items.length})`}
            </button>
          </>
        )}
      </div>

      {showItems && tx.items && tx.items.length > 0 && (
        <div className="border-t border-[rgb(var(--border-soft))] px-4 py-2.5 space-y-1">
          {tx.items.map((item, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate text-[rgb(var(--foreground))]">
                {item.quantity && item.quantity !== 1 ? `${item.quantity}× ` : ""}{item.name}
              </span>
              <span className="shrink-0 tabular-nums text-[rgb(var(--muted))]">
                {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-2 border-t border-[rgb(var(--border-soft))] pt-1.5 text-[11px] font-semibold">
            <span className="text-[rgb(var(--muted))]">{t("chat.itemsTotal")}</span>
            <span className="tabular-nums">
              {effectiveAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {effectiveCurrency}
            </span>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="border-t border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] p-4 space-y-3">
          {/* Amount + Currency */}
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
                className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                {t("chat.currency")}
              </label>
              <select
                value={override?.currency ?? tx.currency}
                onChange={(e) => onUpdateOverride({ currency: e.target.value })}
                className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
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

          {/* Date + Account */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                {t("transactions.dateLabel")}
              </label>
              <input
                type="date"
                value={(override?.date ?? tx.date).slice(0, 10)}
                onChange={(e) => onUpdateOverride({ date: e.target.value })}
                className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              />
            </div>
            {accounts.length > 0 && (
              <AccountPicker
                accounts={accounts}
                value={effectiveAccountId ?? undefined}
                onChange={(id) => onUpdateOverride({ accountId: id })}
                label={tx.type === "TRANSFER"
                  ? (locale === "ru" ? "Счет (откуда)" : "From account")
                  : t("transactions.account")}
              />
            )}
          </div>

          {/* To account (transfer) */}
          {tx.type === "TRANSFER" && accounts.length > 1 && (
            <AccountPicker
              accounts={accounts.filter((a) => a.id !== effectiveAccountId)}
              value={override?.toAccountId ?? undefined}
              onChange={(id) => onUpdateOverride({ toAccountId: id })}
              label={locale === "ru" ? "Счет (куда)" : "To account"}
            />
          )}

          {/* Merchant */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
              {t("transactions.merchantLabel")}
            </label>
            <input
              type="text"
              value={override?.merchant ?? tx.merchant ?? ""}
              onChange={(e) => onUpdateOverride({ merchant: e.target.value || null })}
              placeholder="—"
              className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
            />
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                {t("transactions.category")}
              </label>
              <select
                value={override?.categoryId ?? ""}
                onChange={(e) => onUpdateOverride({ categoryId: e.target.value || null })}
                className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              >
                <option value="">{t("transactions.noCategory")}</option>
                {categories
                  .filter((c) => c.type === tx.type || c.type === "EXPENSE")
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </div>
          )}

          {/* Comment */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
              {t("transactions.comment")}
            </label>
            <input
              type="text"
              value={override?.comment ?? tx.comment ?? ""}
              onChange={(e) => onUpdateOverride({ comment: e.target.value || null })}
              placeholder="—"
              className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
            />
          </div>
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
      return <BudgetConfirmCard op={op as SetBudgetOp} t={t} />;
    case "CREATE_GOAL":
      return <GoalConfirmCard op={op as CreateGoalOp} t={t} locale={locale} />;
    case "DELETE_TRANSACTIONS":
      return <DeleteTxConfirmCard op={op as DeleteTransactionsOp} t={t} />;
    case "UPDATE_TRANSACTION":
      return <UpdateTxConfirmCard op={op as UpdateTransactionOp} t={t} locale={locale} />;
    case "UPDATE_GOAL_PROGRESS":
      return <UpdateGoalConfirmCard op={op as UpdateGoalProgressOp} t={t} />;
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
    case "DELETE_TRANSACTIONS": {
      const delOp = op as DeleteTransactionsOp;
      return (
        <SimpleSavedCard
          icon={<TrashIcon size={10} weight="bold" />}
          label={t("chat.txDeleted")}
          detail={`${delOp.ids.length} ${delOp.ids.length === 1 ? t("chat.transaction") : t("chat.transactions")}`}
        />
      );
    }
    case "UPDATE_TRANSACTION":
      return (
        <SimpleSavedCard
          icon={<PencilSimpleIcon size={10} weight="bold" />}
          label={t("chat.txUpdated")}
          detail={(op as UpdateTransactionOp).id.slice(0, 8) + "…"}
        />
      );
    case "UPDATE_GOAL_PROGRESS":
      return (
        <SimpleSavedCard
          icon={<TargetIcon size={10} weight="bold" />}
          label={t("chat.goalUpdated")}
          detail={(op as UpdateGoalProgressOp).goalName}
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

function BudgetConfirmCard({ op, t }: { op: SetBudgetOp; t: (key: string) => string }) {
  const periodLabel: Record<string, string> = {
    MONTHLY: t("budget.monthly"),
    QUARTERLY: t("budget.quarterly"),
    YEARLY: t("budget.yearly"),
  };

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

function DeleteTxConfirmCard({ op, t }: { op: DeleteTransactionsOp; t: (key: string) => string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--negative-dim))] bg-[rgb(var(--surface))]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--negative-dim))]">
          <TrashIcon size={16} className="text-[rgb(var(--negative))]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[rgb(var(--foreground))]">
            {op.ids.length} {op.ids.length === 1 ? t("chat.transaction") : t("chat.transactions")}
          </div>
          <div className="text-xs text-[rgb(var(--negative))]">{t("chat.willBeDeleted")}</div>
        </div>
        <span className="shrink-0 rounded-full bg-[rgb(var(--negative-dim))] px-2.5 py-0.5 text-xs font-medium text-[rgb(var(--negative))]">
          {t("chat.deleteOp")}
        </span>
      </div>
    </div>
  );
}

function UpdateTxConfirmCard({
  op,
  t,
  locale,
}: {
  op: UpdateTransactionOp;
  t: (key: string) => string;
  locale: string;
}) {
  const fields = op.fields;
  const changes: string[] = [];
  if (fields.amount !== undefined) changes.push(`${t("transactions.amount")}: ${fields.amount}`);
  if (fields.currency !== undefined) changes.push(`${t("chat.currency")}: ${fields.currency}`);
  if (fields.merchant !== undefined) changes.push(`${t("transactions.merchantLabel")}: ${fields.merchant ?? "—"}`);
  if (fields.date !== undefined) changes.push(`${t("transactions.dateLabel")}: ${formatDate(fields.date, locale)}`);
  if (fields.comment !== undefined) changes.push(`${t("transactions.comment")}: ${fields.comment ?? "—"}`);

  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-soft))]">
          <PencilSimpleIcon size={16} className="text-[rgb(var(--muted))]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[rgb(var(--foreground))]">{t("chat.updateTxTitle")}</div>
          {changes.length > 0 && (
            <div className="mt-0.5 text-xs text-[rgb(var(--muted))]">{changes.join(" · ")}</div>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-[rgb(var(--surface-soft))] px-2.5 py-0.5 text-xs font-medium text-[rgb(var(--muted))]">
          {t("chat.updateOp")}
        </span>
      </div>
    </div>
  );
}

function UpdateGoalConfirmCard({ op, t }: { op: UpdateGoalProgressOp; t: (key: string) => string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-soft))]">
          <TargetIcon size={16} className="text-[rgb(var(--muted))]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[rgb(var(--foreground))]">{op.goalName}</div>
          <div className="text-xs text-[rgb(var(--muted))]">
            {t("chat.newProgress")}: {op.amount.toLocaleString()}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[rgb(var(--surface-soft))] px-2.5 py-0.5 text-xs font-medium text-[rgb(var(--muted))]">
          {t("chat.updateGoalOp")}
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
        {tx.tags && tx.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tx.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[rgb(var(--surface-soft))] border border-[rgb(var(--border-soft))] px-1.5 py-px text-[9px] text-[rgb(var(--muted))]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
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

// ─── Bank statement import / saved cards ──────────────────────────────────────

function fmtStatementDate(iso: string, locale: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtStatementAmount(n: number, currency: string) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;
}

function StatementImportCard({
  summary,
  onConfirm,
  onReject,
  onStop,
  saving,
  saveProgress,
  t,
}: {
  summary: StatementSummary;
  onConfirm: () => void;
  onReject: () => void;
  onStop: () => void;
  saving: boolean;
  saveProgress: { done: number; total: number } | null;
  t: (key: string) => string;
}) {
  const R = 16;
  const circumference = 2 * Math.PI * R;
  const progress = saveProgress && saveProgress.total > 0 ? saveProgress.done / saveProgress.total : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgb(var(--border-soft))] px-4 py-3">
        <div className="flex items-center gap-2">
          <BankIcon size={14} weight="bold" className="shrink-0 text-[rgb(var(--accent))]" />
          <span className="text-sm font-semibold">{t("chat.statementImportTitle")}</span>
        </div>
        <span className="text-xs text-[rgb(var(--muted))]">
          <span className="font-semibold tabular-nums text-[rgb(var(--foreground))]">{summary.count}</span>
          {" "}{t("chat.statementTransactions")}
        </span>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 space-y-2.5">
        {summary.periodFrom && summary.periodTo && (
          <p className="text-xs text-[rgb(var(--muted))]">
            {fmtStatementDate(summary.periodFrom, "ru")} — {fmtStatementDate(summary.periodTo, "ru")}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {summary.totalIncome > 0 && (
            <div className="rounded-xl bg-[rgb(var(--positive-dim))] px-3 py-2.5">
              <p className="mb-1 text-[10px] font-medium text-[rgb(var(--positive))]">{t("chat.statementIncome")}</p>
              <p className="text-sm font-semibold tabular-nums leading-tight text-[rgb(var(--positive))]">
                +{fmtStatementAmount(summary.totalIncome, summary.currency)}
              </p>
            </div>
          )}
          {summary.totalExpenses > 0 && (
            <div className="rounded-xl bg-[rgb(var(--negative-dim))] px-3 py-2.5">
              <p className="mb-1 text-[10px] font-medium text-[rgb(var(--negative))]">{t("chat.statementExpenses")}</p>
              <p className="text-sm font-semibold tabular-nums leading-tight text-[rgb(var(--negative))]">
                −{fmtStatementAmount(summary.totalExpenses, summary.currency)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions / saving */}
      <div className="border-t border-[rgb(var(--border-soft))] px-4 py-3">
        {saving ? (
          <div className="flex items-center gap-3">
            {/* SVG circular progress ring */}
            <svg width="40" height="40" className="shrink-0 -rotate-90">
              <circle cx="20" cy="20" r={R} fill="none" stroke="rgb(var(--border))" strokeWidth="3" />
              <circle
                cx="20" cy="20" r={R}
                fill="none"
                stroke="rgb(var(--accent))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 0.35s ease" }}
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-[rgb(var(--foreground))]">
                {saveProgress ? `${saveProgress.done} / ${saveProgress.total}` : t("chat.statementSaving")}
              </p>
              <p className="text-xs text-[rgb(var(--muted))]">{t("chat.statementSaving")}</p>
            </div>
            <button
              onClick={onStop}
              className="shrink-0 rounded-lg border border-[rgb(var(--border))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--muted))] transition hover:border-[rgb(var(--negative))] hover:text-[rgb(var(--negative))] active:scale-95"
            >
              {t("chat.statementStop")}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onConfirm}
              className="flex h-9 flex-1 items-center justify-center rounded-xl bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-80 active:scale-[0.98]"
            >
              {t("chat.statementImportConfirm")}
            </button>
            <button
              onClick={onReject}
              className="flex h-9 items-center justify-center rounded-xl border border-[rgb(var(--border))] px-4 text-sm font-medium text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.98]"
            >
              {t("chat.statementImportCancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatementStoppedCard({
  progress,
  summary,
  t,
  locale,
}: {
  progress: { done: number; total: number };
  summary: StatementSummary;
  t: (key: string) => string;
  locale: string;
}) {
  const note = t("chat.statementStoppedNote")
    .replace("{done}", String(progress.done))
    .replace("{total}", String(progress.total));

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--border))]">
          <XIcon size={9} weight="bold" className="text-[rgb(var(--muted))]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("chat.statementStopped")}</p>
          <p className="text-xs text-[rgb(var(--muted))]">{note}</p>
        </div>
      </div>
      {(summary.periodFrom && summary.periodTo) && (
        <div className="border-t border-[rgb(var(--border-soft))] px-4 py-2 text-xs text-[rgb(var(--muted))]">
          {fmtStatementDate(summary.periodFrom, locale)} — {fmtStatementDate(summary.periodTo, locale)}
        </div>
      )}
    </div>
  );
}

function StatementSavedCard({
  operations,
  summary,
  t,
  locale,
}: {
  operations: AiOperation[];
  summary: StatementSummary;
  t: (key: string) => string;
  locale: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const allTx = operations.flatMap((op) =>
    op.type === "CREATE_TRANSACTIONS" ? (op as CreateTransactionsOp).transactions : []
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--positive))]">
            <CheckIcon size={9} weight="bold" className="text-white" />
          </div>
          <span className="text-sm font-semibold">
            {summary.count} {t("chat.statementTransactions")} · {t("chat.statementImported")}
          </span>
        </div>
        {allTx.length > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-[rgb(var(--muted))] transition hover:text-[rgb(var(--foreground))]"
          >
            {expanded ? t("chat.statementHideList") : t("chat.statementShowList")}
          </button>
        )}
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[rgb(var(--border-soft))] px-4 py-2">
        {summary.periodFrom && summary.periodTo && (
          <span className="text-xs text-[rgb(var(--muted))]">
            {fmtStatementDate(summary.periodFrom, locale)} — {fmtStatementDate(summary.periodTo, locale)}
          </span>
        )}
        {summary.totalIncome > 0 && (
          <span className="text-xs font-medium tabular-nums text-[rgb(var(--positive))]">
            +{fmtStatementAmount(summary.totalIncome, summary.currency)}
          </span>
        )}
        {summary.totalExpenses > 0 && (
          <span className="text-xs font-medium tabular-nums text-[rgb(var(--negative))]">
            −{fmtStatementAmount(summary.totalExpenses, summary.currency)}
          </span>
        )}
      </div>

      {/* Expandable transaction list */}
      {expanded && allTx.length > 0 && (
        <div className="thin-scrollbar max-h-80 overflow-y-auto border-t border-[rgb(var(--border-soft))]">
          <div className="space-y-1.5 p-3">
            {allTx.map((tx, i) => (
              <TxSavedCard key={i} tx={tx} t={t} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
