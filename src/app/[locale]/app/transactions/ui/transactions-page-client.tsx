"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { AccountPicker } from "@/shared/ui/account-picker";
import { AmountInput } from "@/shared/ui/amount-input";
import { Modal } from "@/shared/ui/modal";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowsLeftRightIcon,
  CalendarBlankIcon,
  CheckIcon,
  CheckSquareIcon,
  DownloadSimpleIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  PencilLineIcon,
  PlusIcon,
  SquareIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";

type TransactionItemRow = {
  id: string;
  name: string;
  quantity?: string | null;
  unitPrice?: string | null;
  amount: string;
};

type Transaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: string;
  currency: string;
  date: string;
  merchant?: string | null;
  counterparty?: string | null;
  comment?: string | null;
  category?: { id: string; name: string; icon?: string | null; type: string } | null;
  account?: { id: string; name: string } | null;
  tags?: { tag: { id: string; name: string } }[];
  items?: TransactionItemRow[];
};

type Category = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  icon?: string | null;
};

type DayGroup = { label: string; iso: string; items: Transaction[] };
type Filter = "ALL" | "INCOME" | "EXPENSE" | "TRANSFER";

const COMMON_CURRENCIES = [
  "USD", "EUR", "RUB", "GBP", "AED", "CNY", "JPY", "TRY", "KZT", "UAH",
  "BTC", "ETH",
];

function groupByDay(txs: Transaction[], locale: string): DayGroup[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const key = tx.date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([iso, items]) => ({
      iso,
      label: new Date(iso + "T12:00:00").toLocaleDateString(dateLocale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      items,
    }));
}

function dayTotal(items: Transaction[]): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const tx of items) {
    const n = Number(tx.amount);
    if (tx.type === "INCOME") income += n;
    else if (tx.type === "EXPENSE") expense += n;
  }
  return { income, expense };
}

const todayIso = new Date().toISOString().split("T")[0];

export function TransactionsPageClient() {
  const { t, locale } = useI18n();
  const { workspace, accounts, defaultAccount, isLoading: bootstrapLoading, reload: reloadContext, isViewer } = useLuca();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Filters
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterAccountId, setFilterAccountId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // UI
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingTx, setSavingTx] = useState(false);
  const [addForm, setAddForm] = useState({
    type: "EXPENSE" as "INCOME" | "EXPENSE" | "TRANSFER",
    amount: "",
    currency: "",
    categoryId: "",
    merchant: "",
    comment: "",
    date: todayIso,
    accountId: "",
    toAccountId: "",
  });
  const [crossRateAmount, setCrossRateAmount] = useState("");
  const [crossRateLockedByUser, setCrossRateLockedByUser] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);

  function buildQuery(cursor?: string) {
    const p = new URLSearchParams({ workspaceId: workspace!.id, limit: "50" });
    if (filter !== "ALL") p.set("type", filter);
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    if (filterAccountId) p.set("accountId", filterAccountId);
    if (filterCategoryId) p.set("categoryId", filterCategoryId);
    if (cursor) p.set("cursor", cursor);
    return `/api/transactions?${p}`;
  }

  function loadTransactions() {
    if (!workspace) return;
    setLoading(true);
    setLoadError(false);
    setNextCursor(null);
    apiFetch<{ transactions: Transaction[]; nextCursor: string | null; hasMore: boolean }>(buildQuery())
      .then((r) => {
        setTransactions(r.transactions);
        setNextCursor(r.nextCursor);
        setHasMore(r.hasMore);
      })
      .catch((err) => { console.error(err); setLoadError(true); })
      .finally(() => setLoading(false));
  }

  async function loadMore() {
    if (!workspace || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await apiFetch<{ transactions: Transaction[]; nextCursor: string | null; hasMore: boolean }>(buildQuery(nextCursor));
      setTransactions((prev) => [...prev, ...r.transactions]);
      setNextCursor(r.nextCursor);
      setHasMore(r.hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, [workspace, filter, debouncedSearch, dateFrom, dateTo, filterAccountId, filterCategoryId]);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]);

  useEffect(() => {
    if (!workspace || categories.length > 0) return;
    apiFetch<{ categories: Category[] }>(`/api/categories?workspaceId=${workspace.id}`)
      .then((r) => setCategories(r.categories))
      .catch(console.error);
  }, [workspace]);

  useEffect(() => {
    if (defaultAccount && !addForm.accountId) {
      setAddForm((f) => ({
        ...f,
        accountId: defaultAccount.id,
        currency: f.currency || defaultAccount.currency,
      }));
    }
  }, [defaultAccount]);

  const selectedAccount = accounts.find((a) => a.id === addForm.accountId);
  const isForeignCurrency = !!(selectedAccount && addForm.currency && addForm.currency !== selectedAccount.currency);

  useEffect(() => {
    if (!isForeignCurrency || !addForm.amount || !selectedAccount) {
      if (!isForeignCurrency) setCrossRateAmount("");
      return;
    }
    if (crossRateLockedByUser) return;
    const n = parseFloat(addForm.amount);
    if (isNaN(n) || n === 0) { setCrossRateAmount(""); return; }
    setFetchingRate(true);
    apiFetch<{ rates: Record<string, number> }>(`/api/exchange-rates?base=${addForm.currency}`)
      .then((res) => {
        const rate = res.rates[selectedAccount.currency];
        if (rate) setCrossRateAmount((n * rate).toFixed(2));
        else setCrossRateAmount("");
      })
      .catch(() => setCrossRateAmount(""))
      .finally(() => setFetchingRate(false));
  }, [addForm.amount, addForm.currency, addForm.accountId, isForeignCurrency, crossRateLockedByUser]);

  async function deleteTransaction(id: string) {
    setDeletingId(id);
    setConfirmDeleteId(null);
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

  async function bulkDeleteTransactions(ids: string[]) {
    if (!workspace || ids.length === 0) return;
    setBulkDeleting(true);
    try {
      await apiFetch("/api/transactions/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ workspaceId: workspace.id, ids }),
      });
      setTransactions((prev) => prev.filter((tx) => !ids.includes(tx.id)));
      setSelectedIds(new Set());
      setSelectionMode(false);
      setDeleteAllConfirm(false);
      reloadContext();
    } catch (err) {
      console.error(err);
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createTransaction() {
    if (!workspace || !addForm.amount) return;
    const accountId = addForm.accountId || defaultAccount?.id;
    if (!accountId) return;
    const currency = addForm.currency || accounts.find((a) => a.id === accountId)?.currency || workspace.baseCurrency;
    if (addForm.type === "TRANSFER" && !addForm.toAccountId) return;
    setSavingTx(true);
    try {
      const accountAmount = isForeignCurrency && crossRateAmount && Number(crossRateAmount) > 0 ? Number(crossRateAmount) : null;
      const tx = await apiFetch<{ transaction: Transaction }>("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: workspace.id,
          accountId,
          toAccountId: addForm.type === "TRANSFER" ? addForm.toAccountId || null : null,
          type: addForm.type,
          amount: Number(addForm.amount),
          currency,
          accountAmount,
          date: addForm.date,
          categoryId: addForm.categoryId || null,
          merchant: addForm.merchant || null,
          comment: addForm.comment || null,
          source: "MANUAL",
        }),
      });
      setShowAddForm(false);
      setAddForm({
        type: "EXPENSE",
        amount: "",
        currency: defaultAccount?.currency ?? workspace.baseCurrency,
        categoryId: "",
        merchant: "",
        comment: "",
        date: todayIso,
        accountId: defaultAccount?.id ?? "",
        toAccountId: "",
      });
      setCrossRateAmount("");
      setCrossRateLockedByUser(false);
      setTransactions((prev) => [tx.transaction, ...prev]);
      reloadContext();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTx(false);
    }
  }

  async function handleCSVExport() {
    if (!workspace) return;
    setCsvLoading(true);
    try {
      const p = new URLSearchParams({ workspaceId: workspace.id, format: "csv", limit: "5000" });
      if (filter !== "ALL") p.set("type", filter);
      if (debouncedSearch) p.set("search", debouncedSearch);
      if (dateFrom) p.set("dateFrom", dateFrom);
      if (dateTo) p.set("dateTo", dateTo);
      if (filterAccountId) p.set("accountId", filterAccountId);
      if (filterCategoryId) p.set("categoryId", filterCategoryId);
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const { createSupabaseBrowserClient } = await import("@/shared/lib/supabase/client");
      const { data: { session } } = await createSupabaseBrowserClient().auth.getSession();
      const res = await fetch(`${apiBase}/api/transactions?${p.toString()}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "luca-transactions.csv";
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      setCsvLoading(false);
    }
  }

  const groups = groupByDay(transactions, locale);
  const isSpinning = bootstrapLoading || loading;
  const hasActiveFilters = !!(dateFrom || dateTo || filterAccountId || filterCategoryId || debouncedSearch);
  const filteredCategories = categories.filter((c) => c.type === addForm.type || c.type === "TRANSFER");

  function clearFilters() {
    setDateFrom(""); setDateTo(""); setFilterAccountId(""); setFilterCategoryId(""); setSearch("");
  }

  const typeLabel = (f: Filter) => {
    if (f === "ALL") return t("transactions.filterAll");
    if (f === "INCOME") return t("transactions.income");
    if (f === "EXPENSE") return t("transactions.expense");
    return locale === "ru" ? "Перевод" : "Transfer";
  };

  return (
    <div className="luca-page">
      {loadError && (
        <div className="mb-4 rounded-xl border border-[rgb(var(--negative-dim))] bg-[rgb(var(--negative-dim))] px-4 py-3 text-sm text-[rgb(var(--negative))]">
          {t("common.errorLoading")}
        </div>
      )}

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("transactions.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("transactions.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCSVExport}
            disabled={csvLoading}
            title={t("transactions.exportCsv")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))] disabled:opacity-50"
          >
            <DownloadSimpleIcon size={15} />
          </button>
          {!isViewer && (
            <>
              {!selectionMode && (
                <button
                  onClick={() => setDeleteAllConfirm(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] px-3 text-sm font-medium text-[rgb(var(--negative))] transition hover:bg-[rgb(var(--negative-dim))]"
                  title={locale === "ru" ? "Удалить все" : "Delete all"}
                >
                  <TrashIcon size={14} weight="bold" />
                </button>
              )}
              <button
                onClick={() => { setSelectionMode((v) => !v); setSelectedIds(new Set()); }}
                className={[
                  "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition",
                  selectionMode
                    ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent-dim))] text-[rgb(var(--accent))]"
                    : "border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]",
                ].join(" ")}
              >
                {selectionMode ? <CheckSquareIcon size={14} weight="bold" /> : <SquareIcon size={14} />}
                <span className="hidden sm:inline">{locale === "ru" ? "Выбрать" : "Select"}</span>
              </button>
              {!selectionMode && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-[rgb(var(--foreground))] px-4 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 active:scale-[0.97]"
                >
                  <PlusIcon size={14} weight="bold" />
                  <span className="hidden sm:inline">{t("transactions.new")}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete all confirmation bar */}
      {deleteAllConfirm && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[rgb(var(--negative-dim))] bg-[rgb(var(--negative-dim))] px-4 py-3">
          <span className="text-sm font-medium text-[rgb(var(--negative))]">
            {locale === "ru"
              ? `Удалить все ${transactions.length} транзакций? Действие необратимо.`
              : `Delete all ${transactions.length} transactions? This cannot be undone.`}
          </span>
          <div className="flex shrink-0 items-center gap-2 ml-4">
            <button
              onClick={() => bulkDeleteTransactions(transactions.map((tx) => tx.id))}
              disabled={bulkDeleting}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-[rgb(var(--negative))] px-3 text-xs font-medium text-white disabled:opacity-50"
            >
              <TrashIcon size={12} weight="bold" />
              {locale === "ru" ? "Да, удалить" : "Yes, delete"}
            </button>
            <button
              onClick={() => setDeleteAllConfirm(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]"
            >
              <XIcon size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      <Modal
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        title={t("transactions.addTitle")}
        maxWidth="md"
        footer={
          <button
            onClick={createTransaction}
            disabled={savingTx || !addForm.amount || (addForm.type === "TRANSFER" && !addForm.toAccountId)}
            className="h-11 w-full rounded-xl bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
          >
            {savingTx ? t("common.loading") : t("common.save")}
          </button>
        }
      >
        <div className="space-y-4">
          {/* Type tabs */}
          <div className="flex gap-1 rounded-xl bg-[rgb(var(--surface-soft))] p-1">
            {(["EXPENSE", "INCOME", "TRANSFER"] as const).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setAddForm((f) => ({ ...f, type: tp, categoryId: "", toAccountId: "" }))}
                className={[
                  "flex-1 rounded-lg py-1.5 text-xs font-medium transition",
                  addForm.type === tp
                    ? tp === "EXPENSE"
                      ? "bg-[rgb(var(--negative))] text-white shadow-sm"
                      : tp === "INCOME"
                        ? "bg-[rgb(var(--positive))] text-white shadow-sm"
                        : "bg-[rgb(var(--foreground))] text-[rgb(var(--background))] shadow-sm"
                    : "text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]",
                ].join(" ")}
              >
                {typeLabel(tp)}
              </button>
            ))}
          </div>

          {/* Accounts */}
          {accounts.length > 0 && (
            <AccountPicker
              accounts={accounts}
              value={addForm.accountId}
              onChange={(id) => {
                const acc = accounts.find((a) => a.id === id);
                setAddForm((f) => ({ ...f, accountId: id, currency: acc?.currency ?? f.currency }));
                setCrossRateLockedByUser(false);
                setCrossRateAmount("");
              }}
              label={addForm.type === "TRANSFER" ? (locale === "ru" ? "Откуда" : "From account") : (locale === "ru" ? "Счёт" : "Account")}
            />
          )}
          {addForm.type === "TRANSFER" && accounts.length > 1 && (
            <AccountPicker
              accounts={accounts.filter((a) => a.id !== addForm.accountId)}
              value={addForm.toAccountId}
              onChange={(id) => setAddForm((f) => ({ ...f, toAccountId: id }))}
              label={locale === "ru" ? "Куда" : "To account"}
            />
          )}

          {/* Amount + currency */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
              {t("transactions.amount")}
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <AmountInput
                  value={addForm.amount}
                  onChange={(v) => { setAddForm((f) => ({ ...f, amount: v })); setCrossRateLockedByUser(false); }}
                  currency={addForm.currency || selectedAccount?.currency || ""}
                  placeholder="0.00"
                />
              </div>
              <select
                value={addForm.currency}
                onChange={(e) => { setAddForm((f) => ({ ...f, currency: e.target.value })); setCrossRateLockedByUser(false); setCrossRateAmount(""); }}
                className="h-10 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2 text-sm outline-none focus:border-[rgb(var(--accent))]"
              >
                {selectedAccount && <option value={selectedAccount.currency}>{selectedAccount.currency}</option>}
                {COMMON_CURRENCIES.filter((c) => c !== selectedAccount?.currency).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {isForeignCurrency && (
              <div className="mt-2 flex items-center gap-2">
                <ArrowRightIcon size={11} className="shrink-0 text-[rgb(var(--muted-soft))]" />
                <input
                  type="number" min="0" step="any"
                  value={crossRateAmount}
                  onChange={(e) => { setCrossRateAmount(e.target.value); setCrossRateLockedByUser(true); }}
                  placeholder="0.00"
                  className="h-8 w-28 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2.5 text-sm outline-none focus:border-[rgb(var(--accent))]"
                />
                <span className="text-xs text-[rgb(var(--muted))]">{selectedAccount?.currency}</span>
                {fetchingRate && <span className="text-[11px] text-[rgb(var(--muted-soft))]">…</span>}
                {crossRateLockedByUser && (
                  <button type="button" onClick={() => { setCrossRateLockedByUser(false); setCrossRateAmount(""); }} className="text-[10px] text-[rgb(var(--accent))] hover:underline">
                    auto
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Category */}
          {filteredCategories.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                {t("transactions.category")}
              </label>
              <div className="max-h-28 overflow-y-auto rounded-lg border border-[rgb(var(--border-soft))] p-1.5">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, categoryId: "" }))}
                    className={[
                      "rounded-lg border px-2.5 py-1 text-xs transition",
                      !addForm.categoryId
                        ? "border-[rgb(var(--foreground))] bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                        : "border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]",
                    ].join(" ")}
                  >
                    {locale === "ru" ? "Без категории" : "None"}
                  </button>
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, categoryId: cat.id }))}
                      className={[
                        "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition",
                        addForm.categoryId === cat.id
                          ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent))]"
                          : "border-[rgb(var(--border))] text-[rgb(var(--foreground))] hover:bg-[rgb(var(--surface-soft))]",
                      ].join(" ")}
                    >
                      {cat.icon && <span className="leading-none">{cat.icon}</span>}
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Date + Merchant */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("transactions.dateLabel")}</label>
              <input
                type="date"
                value={addForm.date.slice(0, 10)}
                onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("transactions.merchantLabel")}</label>
              <input
                value={addForm.merchant}
                onChange={(e) => setAddForm((f) => ({ ...f, merchant: e.target.value }))}
                placeholder="Nobu, Netflix…"
                className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("transactions.comment")}</label>
            <input
              value={addForm.comment}
              onChange={(e) => setAddForm((f) => ({ ...f, comment: e.target.value }))}
              placeholder={locale === "ru" ? "Заметка…" : "Note…"}
              className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
            />
          </div>
        </div>
      </Modal>

      {/* Edit Transaction Modal */}
      <EditModal
        tx={editingTx}
        categories={categories}
        locale={locale}
        t={t}
        onClose={() => setEditingTx(null)}
        onSave={(updated) => {
          setTransactions((prev) => prev.map((tx) => (tx.id === updated.id ? updated : tx)));
          setEditingTx(null);
        }}
      />

      {/* Search + filter bar */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={locale === "ru" ? "Поиск по названию, заметке…" : "Search merchant, note…"}
              className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] pl-8 pr-8 text-sm outline-none focus:border-[rgb(var(--accent))]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]">
                <XIcon size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={[
              "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition",
              showFilters || hasActiveFilters
                ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)] text-[rgb(var(--accent))]"
                : "border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]",
            ].join(" ")}
          >
            <FunnelSimpleIcon size={14} />
            <span className="hidden sm:inline">{t("transactions.filters")}</span>
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-[9px] font-bold text-white">
                {[dateFrom || dateTo ? 1 : 0, filterAccountId ? 1 : 0, filterCategoryId ? 1 : 0, debouncedSearch ? 1 : 0].reduce((a, b) => a + b, 0)}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">
                  <CalendarBlankIcon size={11} className="mr-1 inline" />
                  {t("transactions.dateFrom")}
                </label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">
                  <CalendarBlankIcon size={11} className="mr-1 inline" />
                  {t("transactions.dateTo")}
                </label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]" />
              </div>
              {accounts.length > 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">{t("transactions.account")}</label>
                  <select value={filterAccountId} onChange={(e) => setFilterAccountId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]">
                    <option value="">{t("transactions.allAccounts")}</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">{t("transactions.category")}</label>
                <select value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]">
                  <option value="">{t("transactions.allCategories")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-3 text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--negative))] transition">
                {t("transactions.clearFilters")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Type filter tabs */}
      <div className="mb-4 flex items-center gap-1">
        {(["ALL", "INCOME", "EXPENSE", "TRANSFER"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              filter === f
                ? "bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]",
            ].join(" ")}
          >
            {typeLabel(f)}
          </button>
        ))}
        {!isSpinning && transactions.length > 0 && (
          <span className="ml-auto text-xs text-[rgb(var(--muted-soft))]">
            {transactions.length}{hasMore ? "+" : ""} {locale === "ru" ? "записей" : "records"}
          </span>
        )}
      </div>

      {/* Content */}
      {isSpinning ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-4 w-32 animate-pulse rounded bg-[rgb(var(--surface-soft))]" />
              <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))]">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-12 animate-pulse border-b border-[rgb(var(--border-soft))] bg-[rgb(var(--surface))] last:border-0" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--surface-soft))]">
            <span className="text-3xl opacity-25">💸</span>
          </div>
          <p className="text-sm text-[rgb(var(--muted))]">{t("transactions.empty")}</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-3 text-xs text-[rgb(var(--accent))] hover:underline">
              {t("transactions.clearFilters")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const totals = dayTotal(group.items);
            return (
              <div key={group.iso}>
                {/* Day header */}
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold capitalize text-[rgb(var(--muted))]">
                    {group.label}
                  </span>
                  <div className="flex items-center gap-2 text-xs tabular-nums">
                    {totals.income > 0 && (
                      <span className="text-[rgb(var(--positive))]">+{totals.income.toFixed(0)}</span>
                    )}
                    {totals.expense > 0 && (
                      <span className="text-[rgb(var(--negative))]">−{totals.expense.toFixed(0)}</span>
                    )}
                  </div>
                </div>

                {/* Transactions list */}
                <div className="overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
                  {group.items.map((tx, idx) => (
                    <TxRow
                      key={tx.id}
                      tx={tx}
                      isLast={idx === group.items.length - 1}
                      isDeleting={deletingId === tx.id}
                      confirmingDelete={confirmDeleteId === tx.id}
                      onDeleteRequest={() => setConfirmDeleteId((prev) => (prev === tx.id ? null : tx.id))}
                      onDeleteConfirm={() => deleteTransaction(tx.id)}
                      onDeleteCancel={() => setConfirmDeleteId(null)}
                      onEdit={() => setEditingTx(tx)}
                      readOnly={isViewer}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(tx.id)}
                      onToggleSelect={() => toggleSelect(tx.id)}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-6 py-2.5 text-sm font-medium text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] disabled:opacity-50"
              >
                {loadingMore ? t("transactions.loadingMore") : t("transactions.loadMore")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectionMode && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3 shadow-lg">
          <span className="text-sm text-[rgb(var(--muted))]">
            {selectedIds.size > 0
              ? (locale === "ru" ? `Выбрано: ${selectedIds.size}` : `Selected: ${selectedIds.size}`)
              : (locale === "ru" ? "Выберите транзакции" : "Select transactions")}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const allIds = transactions.map((tx) => tx.id);
                const allSelected = allIds.every((id) => selectedIds.has(id));
                setSelectedIds(allSelected ? new Set() : new Set(allIds));
              }}
              className="h-8 rounded-lg border border-[rgb(var(--border))] px-3 text-xs font-medium text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
            >
              {locale === "ru" ? "Выбрать все" : "Select all"}
            </button>
            <button
              onClick={() => bulkDeleteTransactions(Array.from(selectedIds))}
              disabled={selectedIds.size === 0 || bulkDeleting}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-[rgb(var(--negative))] px-3 text-xs font-medium text-white disabled:opacity-40"
            >
              <TrashIcon size={12} weight="bold" />
              {locale === "ru" ? `Удалить (${selectedIds.size})` : `Delete (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── TxRow ────────────────────────────────────────────── */
function TxRow({
  tx,
  isLast,
  isDeleting,
  confirmingDelete,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onEdit,
  readOnly = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  t,
}: {
  tx: Transaction;
  isLast: boolean;
  isDeleting: boolean;
  confirmingDelete: boolean;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onEdit: () => void;
  readOnly?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  t: (key: string) => string;
}) {
  const isExpense = tx.type === "EXPENSE";
  const isIncome = tx.type === "INCOME";
  const amount = Number(tx.amount);
  const label = tx.merchant || tx.category?.name || tx.comment || tx.type;
  const sub = [
    tx.merchant && tx.category?.name ? tx.category.name : null,
    tx.account?.name,
  ].filter(Boolean).join(" · ");

  const timeStr = tx.date.length > 10 ? tx.date.slice(11, 16) : null;
  const showTime = timeStr && timeStr !== "00:00";

  const iconBg = isExpense
    ? "bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))]"
    : isIncome
      ? "bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]"
      : "bg-[rgb(var(--surface-soft))] text-[rgb(var(--muted))]";
  const amountColor = isExpense
    ? "text-[rgb(var(--negative))]"
    : isIncome
      ? "text-[rgb(var(--positive))]"
      : "text-[rgb(var(--foreground))]";

  return (
    <div
      onClick={selectionMode ? onToggleSelect : undefined}
      className={[
        "group flex items-center gap-3 px-4 py-3 transition-colors",
        !isLast ? "border-b border-[rgb(var(--border-soft))]" : "",
        isDeleting ? "opacity-40" : "hover:bg-[rgb(var(--surface-soft))]",
        selectionMode ? "cursor-pointer" : "",
        selectionMode && isSelected ? "bg-[rgb(var(--accent-dim))]" : "",
      ].join(" ")}
    >
      {/* Icon or checkbox */}
      {selectionMode ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center text-[rgb(var(--accent))]">
          {isSelected ? <CheckSquareIcon size={20} weight="fill" /> : <SquareIcon size={20} />}
        </div>
      ) : (
        <div className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs", iconBg].join(" ")}>
          {tx.category?.icon ? (
            <span className="leading-none text-sm">{tx.category.icon}</span>
          ) : isExpense ? (
            <ArrowDownIcon size={14} weight="bold" />
          ) : isIncome ? (
            <ArrowUpIcon size={14} weight="bold" />
          ) : (
            <ArrowsLeftRightIcon size={14} weight="bold" />
          )}
        </div>
      )}

      {/* Label */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium leading-snug text-[rgb(var(--foreground))]">{label}</div>
        {(sub || showTime) && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {sub && <span className="truncate text-xs text-[rgb(var(--muted))]">{sub}</span>}
            {showTime && <span className="shrink-0 text-[10px] text-[rgb(var(--muted-soft))]">{timeStr}</span>}
          </div>
        )}
        {tx.tags && tx.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tx.tags.map(({ tag }) => (
              <span
                key={tag.id}
                className="rounded-full border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] px-1.5 py-px text-[9px] text-[rgb(var(--muted))]"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Amount */}
      <div className={["shrink-0 text-right text-sm font-semibold tabular-nums", amountColor].join(" ")}>
        {isExpense ? "−" : isIncome ? "+" : ""}
        {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        {" "}
        <span className="text-xs font-medium">{tx.currency}</span>
      </div>

      {/* Actions */}
      {!readOnly && !selectionMode && (
        <div className="ml-1 flex shrink-0 items-center gap-0.5">
          {confirmingDelete ? (
            <>
              <span className="mr-1 hidden text-xs text-[rgb(var(--muted))] sm:inline">
                {t("transactions.confirmDeleteQ")}
              </span>
              <button
                onClick={onDeleteConfirm}
                disabled={isDeleting}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))] transition hover:opacity-80"
              >
                <CheckIcon size={12} weight="bold" />
              </button>
              <button
                onClick={onDeleteCancel}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
              >
                <XIcon size={12} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition-all hover:bg-[rgb(var(--surface-soft))] sm:opacity-0 sm:group-hover:opacity-100"
                title="Edit"
              >
                <PencilLineIcon size={13} weight="bold" />
              </button>
              <button
                onClick={onDeleteRequest}
                disabled={isDeleting}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition-all hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))] disabled:opacity-30 sm:opacity-0 sm:group-hover:opacity-100"
                title={t("common.delete")}
              >
                <TrashIcon size={13} weight="bold" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Edit Modal ───────────────────────────────────────── */
function EditModal({
  tx,
  categories,
  locale,
  t,
  onClose,
  onSave,
}: {
  tx: Transaction | null;
  categories: Category[];
  locale: string;
  t: (key: string) => string;
  onClose: () => void;
  onSave: (updated: Transaction) => void;
}) {
  const [form, setForm] = useState({
    amount: "",
    currency: "",
    categoryId: "",
    merchant: "",
    comment: "",
    date: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tx) {
      setForm({
        amount: String(Number(tx.amount)),
        currency: tx.currency,
        categoryId: tx.category?.id ?? "",
        merchant: tx.merchant ?? "",
        comment: tx.comment ?? "",
        date: tx.date.slice(0, 10),
      });
    }
  }, [tx]);

  if (!tx) return null;

  const relevantCategories = categories.filter((c) => c.type === tx.type || c.type === "TRANSFER");

  async function save() {
    if (!tx) return;
    setSaving(true);
    try {
      const updated = await apiFetch<{ transaction: Transaction }>(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          date: form.date,
          merchant: form.merchant || null,
          comment: form.comment || null,
          categoryId: form.categoryId || null,
          amount: Number(form.amount),
          currency: form.currency,
        }),
      });
      onSave({
        ...updated.transaction,
        category: categories.find((c) => c.id === form.categoryId) ?? null,
        account: tx.account,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const txTypeLabel = tx.type === "EXPENSE"
    ? (locale === "ru" ? "Расход" : "Expense")
    : tx.type === "INCOME"
      ? (locale === "ru" ? "Доход" : "Income")
      : (locale === "ru" ? "Перевод" : "Transfer");

  return (
    <Modal
      open={!!tx}
      onClose={onClose}
      title={locale === "ru" ? `Изменить · ${txTypeLabel}` : `Edit · ${txTypeLabel}`}
      maxWidth="sm"
      footer={
        <button
          onClick={save}
          disabled={saving || !form.amount}
          className="h-11 w-full rounded-xl bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
        >
          {saving ? t("common.loading") : t("common.save")}
        </button>
      }
    >
      <div className="space-y-4">
        {/* Amount + currency */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("transactions.amount")}</label>
            <input
              type="number" min="0" step="any"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("transactions.currency")}</label>
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="h-10 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2 text-sm outline-none focus:border-[rgb(var(--accent))]"
            >
              {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("transactions.dateLabel")}</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
          />
        </div>

        {/* Category */}
        {relevantCategories.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("transactions.category")}</label>
            <div className="max-h-24 overflow-y-auto rounded-lg border border-[rgb(var(--border-soft))] p-1.5">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, categoryId: "" }))}
                  className={[
                    "rounded-lg border px-2.5 py-1 text-xs transition",
                    !form.categoryId
                      ? "border-[rgb(var(--foreground))] bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                      : "border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]",
                  ].join(" ")}
                >
                  {locale === "ru" ? "Без категории" : "None"}
                </button>
                {relevantCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, categoryId: cat.id }))}
                    className={[
                      "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition",
                      form.categoryId === cat.id
                        ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent))]"
                        : "border-[rgb(var(--border))] text-[rgb(var(--foreground))] hover:bg-[rgb(var(--surface-soft))]",
                    ].join(" ")}
                  >
                    {cat.icon && <span className="leading-none">{cat.icon}</span>}
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Merchant */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("transactions.merchantLabel")}</label>
          <input
            value={form.merchant}
            onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
            placeholder={locale === "ru" ? "Необязательно" : "Optional"}
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
          />
        </div>

        {/* Comment */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{t("transactions.comment")}</label>
          <input
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
            placeholder={locale === "ru" ? "Необязательно" : "Optional"}
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
          />
        </div>

        {/* Tags (read-only) */}
        {tx.tags && tx.tags.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
              {locale === "ru" ? "Теги" : "Tags"}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tx.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="rounded-full border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] px-2.5 py-1 text-xs text-[rgb(var(--muted))]"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Items (read-only) */}
        {tx.items && tx.items.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
              {locale === "ru" ? "Состав чека" : "Receipt items"}
            </label>
            <div className="overflow-hidden rounded-lg border border-[rgb(var(--border-soft))]">
              {tx.items.map((item, idx) => (
                <div
                  key={item.id}
                  className={[
                    "flex items-baseline justify-between gap-2 px-3 py-1.5 text-xs",
                    idx < tx.items!.length - 1 ? "border-b border-[rgb(var(--border-soft))]" : "",
                  ].join(" ")}
                >
                  <span className="min-w-0 truncate text-[rgb(var(--foreground))]">
                    {Number(item.quantity) && Number(item.quantity) !== 1
                      ? `${Number(item.quantity)}× `
                      : ""}
                    {item.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-[rgb(var(--muted))]">
                    {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 py-1.5 text-xs font-semibold">
                <span className="text-[rgb(var(--muted))]">
                  {locale === "ru" ? "Итого" : "Total"}
                </span>
                <span className="tabular-nums">
                  {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tx.currency}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

