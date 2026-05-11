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
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  PencilLineIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";

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
};

type Category = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  icon?: string | null;
};

type DayGroup = {
  label: string;
  iso: string;
  items: Transaction[];
};

type Filter = "ALL" | "INCOME" | "EXPENSE" | "TRANSFER";

const COMMON_CURRENCIES = ["USD", "EUR", "RUB", "GBP", "AED", "CNY", "JPY", "TRY", "KZT", "UAH", "BTC", "ETH"];

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
        day: "numeric",
      }),
      items,
    }));
}

function formatTime(dateStr: string): string | null {
  const time = dateStr.slice(11, 16); // "HH:MM"
  if (!time || time === "00:00") return null;
  return time;
}

const todayIso = new Date().toISOString().split("T")[0];

export function TransactionsPageClient() {
  const { t, locale } = useI18n();
  const { workspace, accounts, defaultAccount, isLoading: bootstrapLoading, reload: reloadContext } = useLuca();

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

  // UI states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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
  // Multi-currency: account currency equivalent when transaction is in a different currency
  const [crossRateAmount, setCrossRateAmount] = useState(""); // account-currency equivalent
  const [crossRateLockedByUser, setCrossRateLockedByUser] = useState(false); // user manually edited it
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
    setNextCursor(null);
    apiFetch<{ transactions: Transaction[]; nextCursor: string | null; hasMore: boolean }>(buildQuery())
      .then((r) => {
        setTransactions(r.transactions);
        setNextCursor(r.nextCursor);
        setHasMore(r.hasMore);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  async function loadMore() {
    if (!workspace || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await apiFetch<{ transactions: Transaction[]; nextCursor: string | null; hasMore: boolean }>(
        buildQuery(nextCursor)
      );
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

  // Debounce search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]);

  // Load categories once
  useEffect(() => {
    if (!workspace || categories.length > 0) return;
    apiFetch<{ categories: Category[] }>(`/api/categories?workspaceId=${workspace.id}`)
      .then((r) => setCategories(r.categories))
      .catch(console.error);
  }, [workspace]);

  // Pre-fill accountId and currency when default account loads
  useEffect(() => {
    if (defaultAccount && !addForm.accountId) {
      setAddForm((f) => ({
        ...f,
        accountId: defaultAccount.id,
        currency: f.currency || defaultAccount.currency,
      }));
    }
  }, [defaultAccount]);

  // Derived: transaction currency differs from account currency → cross-currency transaction
  const selectedAccount = accounts.find((a) => a.id === addForm.accountId);
  const isForeignCurrency = !!(
    selectedAccount &&
    addForm.currency &&
    addForm.currency !== selectedAccount.currency
  );

  // Auto-compute account-currency equivalent when foreign currency is selected
  useEffect(() => {
    if (!isForeignCurrency || !addForm.amount || !selectedAccount) {
      if (!isForeignCurrency) setCrossRateAmount("");
      return;
    }
    if (crossRateLockedByUser) return; // user manually set this value

    const n = parseFloat(addForm.amount);
    if (isNaN(n) || n === 0) { setCrossRateAmount(""); return; }

    setFetchingRate(true);
    apiFetch<{ rates: Record<string, number> }>(
      `/api/exchange-rates?base=${addForm.currency}`
    )
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

  async function createTransaction() {
    if (!workspace || !addForm.amount) return;
    const accountId = addForm.accountId || defaultAccount?.id;
    if (!accountId) return;
    const currency =
      addForm.currency ||
      accounts.find((a) => a.id === accountId)?.currency ||
      workspace.baseCurrency;

    if (addForm.type === "TRANSFER" && !addForm.toAccountId) return;

    setSavingTx(true);
    try {
      // If paying in foreign currency and we have an account-currency override, use it
      const accountAmount =
        isForeignCurrency && crossRateAmount && Number(crossRateAmount) > 0
          ? Number(crossRateAmount)
          : null;

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

  function handleEditSave(updated: Transaction) {
    setTransactions((prev) => prev.map((tx) => (tx.id === updated.id ? updated : tx)));
    setEditingId(null);
  }

  const groups = groupByDay(transactions);
  const isSpinning = bootstrapLoading || loading;

  const hasActiveFilters = !!(dateFrom || dateTo || filterAccountId || filterCategoryId || debouncedSearch);

  const txCountLabel = (n: number) =>
    locale === "ru"
      ? `${n} ${n === 1 ? "операция" : n < 5 ? "операции" : "операций"}`
      : `${n} ${n === 1 ? "transaction" : "transactions"}`;

  const filteredCategories = categories.filter(
    (c) => c.type === addForm.type || c.type === "TRANSFER"
  );

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("transactions.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("transactions.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.97]"
        >
          <PlusIcon size={14} weight="bold" />
          {t("transactions.new")}
        </button>
      </div>

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
          <div className="flex gap-1.5 rounded-xl bg-[rgb(var(--surface-soft))] p-1">
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
                {tp === "EXPENSE" ? t("transactions.expense") : tp === "INCOME" ? t("transactions.income") : t("transactions.transfer")}
              </button>
            ))}
          </div>

          {/* Account picker */}
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
              label={addForm.type === "TRANSFER" ? "From account" : "Account"}
            />
          )}

          {/* To account (transfer only) */}
          {addForm.type === "TRANSFER" && accounts.length > 1 && (
            <AccountPicker
              accounts={accounts.filter((a) => a.id !== addForm.accountId)}
              value={addForm.toAccountId}
              onChange={(id) => setAddForm((f) => ({ ...f, toAccountId: id }))}
              label="To account"
            />
          )}

          {/* Amount */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
              {t("transactions.amount")}
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <AmountInput
                  value={addForm.amount}
                  onChange={(v) => {
                    setAddForm((f) => ({ ...f, amount: v }));
                    setCrossRateLockedByUser(false);
                  }}
                  currency={addForm.currency || selectedAccount?.currency || ""}
                  placeholder="0.00"
                />
              </div>
              {/* Currency selector */}
              <select
                value={addForm.currency}
                onChange={(e) => {
                  setAddForm((f) => ({ ...f, currency: e.target.value }));
                  setCrossRateLockedByUser(false);
                  setCrossRateAmount("");
                }}
                className="h-10 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              >
                {selectedAccount && (
                  <option value={selectedAccount.currency}>{selectedAccount.currency}</option>
                )}
                {COMMON_CURRENCIES.filter((c) => c !== selectedAccount?.currency).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {/* Account-currency equivalent when paying in foreign currency */}
            {isForeignCurrency && (
              <div className="mt-2 flex items-center gap-2">
                <ArrowRightIcon size={11} className="shrink-0 text-[rgb(var(--muted-soft))]" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={crossRateAmount}
                  onChange={(e) => {
                    setCrossRateAmount(e.target.value);
                    setCrossRateLockedByUser(true);
                  }}
                  placeholder="0.00"
                  className="h-8 w-32 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2.5 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
                />
                <span className="text-xs font-medium text-[rgb(var(--muted))]">
                  {selectedAccount?.currency}
                </span>
                {fetchingRate && (
                  <span className="text-[11px] text-[rgb(var(--muted-soft))]">…</span>
                )}
                {crossRateLockedByUser && (
                  <button
                    type="button"
                    onClick={() => { setCrossRateLockedByUser(false); setCrossRateAmount(""); }}
                    className="text-[10px] text-[rgb(var(--accent))] hover:underline"
                  >
                    auto
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Category grid — capped, scrollable if many */}
          {filteredCategories.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">Category</label>
              <div className="relative">
                <div className="max-h-[108px] overflow-y-auto rounded-lg border border-[rgb(var(--border-soft))] p-1.5">
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
                      None
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
                        {cat.icon && <span className="text-sm leading-none">{cat.icon}</span>}
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Date + Merchant row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                {t("transactions.dateLabel")}
              </label>
              <input
                type="date"
                value={addForm.date.slice(0, 10)}
                onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
                {t("transactions.merchantLabel")}
              </label>
              <input
                value={addForm.merchant}
                onChange={(e) => setAddForm((f) => ({ ...f, merchant: e.target.value }))}
                placeholder="Nobu, Netflix..."
                className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
              {t("transactions.comment")}
            </label>
            <input
              value={addForm.comment}
              onChange={(e) => setAddForm((f) => ({ ...f, comment: e.target.value }))}
              placeholder="Optional note..."
              className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
            />
          </div>

        </div>
      </Modal>

      {/* Search + filter bar */}
      <div className="mb-3 space-y-2">
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant, note..."
              className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] pl-8 pr-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.1)]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]"
              >
                <XIcon size={12} />
              </button>
            )}
          </div>

          {/* Filters toggle */}
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
            Filters
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
              {/* Date range */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">
                  <CalendarBlankIcon size={11} className="mr-1 inline" />
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">
                  <CalendarBlankIcon size={11} className="mr-1 inline" />
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
                />
              </div>

              {/* Account filter */}
              {accounts.length > 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">Account</label>
                  <select
                    value={filterAccountId}
                    onChange={(e) => setFilterAccountId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
                  >
                    <option value="">All accounts</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">Category</label>
                <select
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ""}{c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setDateFrom(""); setDateTo(""); setFilterAccountId(""); setFilterCategoryId(""); setSearch("");
                }}
                className="mt-3 text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--negative))] transition"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Type filter tabs */}
      <div className="mb-4 flex gap-1">
        {(["ALL", "INCOME", "EXPENSE", "TRANSFER"] as Filter[]).map((f) => {
          const label =
            f === "ALL"
              ? t("transactions.filterAll")
              : f === "INCOME"
                ? t("transactions.income")
                : f === "EXPENSE"
                  ? t("transactions.expense")
                  : "Transfer";
          return (
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
              {label}
            </button>
          );
        })}
        {!isSpinning && transactions.length > 0 && (
          <span className="ml-auto self-center text-xs text-[rgb(var(--muted-soft))]">
            {txCountLabel(transactions.length)}
            {hasMore && "+"}
          </span>
        )}
      </div>

      {/* Content */}
      {isSpinning ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--surface-soft))]">
            <span className="text-3xl opacity-30">💸</span>
          </div>
          <p className="text-sm text-[rgb(var(--muted))]">{t("transactions.empty")}</p>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setFilterAccountId(""); setFilterCategoryId(""); }}
              className="mt-3 text-xs text-[rgb(var(--accent))] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.iso}>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-[rgb(var(--muted))]">{group.label}</span>
                <span className="text-xs text-[rgb(var(--muted-soft))]">
                  {txCountLabel(group.items.length)}
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
                {group.items.map((tx, idx) => (
                  <TxRow
                    key={tx.id}
                    tx={tx}
                    isLast={idx === group.items.length - 1}
                    isDeleting={deletingId === tx.id}
                    confirmingDelete={confirmDeleteId === tx.id}
                    isEditing={editingId === tx.id}
                    categories={categories}
                    accounts={accounts as { id: string; name: string; currency: string }[]}
                    onDeleteRequest={() => setConfirmDeleteId((prev) => (prev === tx.id ? null : tx.id))}
                    onDeleteConfirm={() => deleteTransaction(tx.id)}
                    onDeleteCancel={() => setConfirmDeleteId(null)}
                    onEditToggle={() => setEditingId((prev) => (prev === tx.id ? null : tx.id))}
                    onEditSave={handleEditSave}
                    t={t}
                  />
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-6 py-2.5 text-sm font-medium text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TxRow ────────────────────────────────────────────────────────────────────

type TxRowAccount = { id: string; name: string; currency: string };

function TxRow({
  tx,
  isLast,
  isDeleting,
  confirmingDelete,
  isEditing,
  categories,
  accounts,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onEditToggle,
  onEditSave,
  t,
}: {
  tx: Transaction;
  isLast: boolean;
  isDeleting: boolean;
  confirmingDelete: boolean;
  isEditing: boolean;
  categories: Category[];
  accounts: TxRowAccount[];
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onEditToggle: () => void;
  onEditSave: (updated: Transaction) => void;
  t: (key: string) => string;
}) {
  const isExpense = tx.type === "EXPENSE";
  const isIncome = tx.type === "INCOME";
  const amount = Number(tx.amount);
  const label = tx.merchant || tx.category?.name || tx.comment || tx.type;
  const sub = [
    tx.merchant && tx.category?.name ? tx.category.name : null,
    tx.account?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  const timeStr = formatTime(tx.date);

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

  // Edit state
  const relevantCategories = categories.filter(
    (c) => c.type === tx.type || c.type === "TRANSFER"
  );
  const [editForm, setEditForm] = useState({
    amount: String(Number(tx.amount)),
    currency: tx.currency,
    categoryId: tx.category?.id ?? "",
    merchant: tx.merchant ?? "",
    comment: tx.comment ?? "",
    date: tx.date.slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setEditForm({
        amount: String(Number(tx.amount)),
        currency: tx.currency,
        categoryId: tx.category?.id ?? "",
        merchant: tx.merchant ?? "",
        comment: tx.comment ?? "",
        date: tx.date.slice(0, 10),
      });
    }
  }, [isEditing]);

  async function saveEdit() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        date: editForm.date,
        merchant: editForm.merchant || null,
        comment: editForm.comment || null,
        categoryId: editForm.categoryId || null,
        amount: Number(editForm.amount),
        currency: editForm.currency,
      };
      const updated = await apiFetch<{ transaction: Transaction }>(
        `/api/transactions/${tx.id}`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      // Merge back the relations that PATCH doesn't return fully
      const merged: Transaction = {
        ...updated.transaction,
        category: categories.find((c) => c.id === (editForm.categoryId || null)) ?? null,
        account: tx.account,
      };
      onEditSave(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className={[
          "group flex items-center gap-3 px-4 py-3.5 transition-colors",
          !isLast && !isEditing ? "border-b border-[rgb(var(--border-soft))]" : "",
          isEditing ? "bg-[rgb(var(--surface-soft))]" : "hover:bg-[rgb(var(--surface-soft))]",
          isDeleting ? "opacity-40" : "",
        ].join(" ")}
      >
        {/* Icon */}
        <div className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm", iconBg].join(" ")}>
          {tx.category?.icon ? (
            <span className="leading-none">{tx.category.icon}</span>
          ) : isExpense ? (
            <ArrowDownIcon size={15} weight="bold" />
          ) : isIncome ? (
            <ArrowUpIcon size={15} weight="bold" />
          ) : (
            <ArrowsLeftRightIcon size={15} weight="bold" />
          )}
        </div>

        {/* Label */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[rgb(var(--foreground))]">{label}</div>
          <div className="flex items-center gap-1.5">
            {sub && <span className="truncate text-xs text-[rgb(var(--muted))]">{sub}</span>}
            {timeStr && (
              <span className="shrink-0 text-xs text-[rgb(var(--muted-soft))]">{timeStr}</span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className={["shrink-0 text-sm font-semibold tabular-nums", amountColor].join(" ")}>
          {isExpense ? "−" : isIncome ? "+" : ""}
          {amount.toFixed(2)} {tx.currency}
        </div>

        {/* Actions */}
        <div className="ml-1 flex shrink-0 items-center gap-0.5">
          {confirmingDelete ? (
            <>
              <span className="mr-1 text-xs text-[rgb(var(--muted))]">{t("transactions.confirmDeleteQ")}</span>
              <button
                onClick={onDeleteConfirm}
                disabled={isDeleting}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))] transition hover:opacity-80"
              >
                <CheckIcon size={11} weight="bold" />
              </button>
              <button
                onClick={onDeleteCancel}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
              >
                <XIcon size={11} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEditToggle}
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                  isEditing
                    ? "bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]"
                    : "text-[rgb(var(--muted))] opacity-0 hover:bg-[rgb(var(--surface-soft))] group-hover:opacity-100",
                ].join(" ")}
                title="Edit"
              >
                <PencilLineIcon size={13} weight="bold" />
              </button>
              <button
                onClick={onDeleteRequest}
                disabled={isDeleting}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--muted))] opacity-0 transition-all hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))] group-hover:opacity-100 disabled:opacity-30"
                title={t("common.delete")}
              >
                <TrashIcon size={13} weight="bold" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline edit panel */}
      {isEditing && (
        <div className={["border-b border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] px-4 pb-4 pt-0", !isLast ? "" : ""].join(" ")}>
          <div className="grid grid-cols-2 gap-3">
            {/* Amount + currency */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">Amount</label>
              <input
                type="number"
                min="0"
                step="any"
                value={editForm.amount}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">Currency</label>
              <select
                value={editForm.currency}
                onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value }))}
                className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
              >
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">Date</label>
              <input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">Category</label>
              <select
                value={editForm.categoryId}
                onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
              >
                <option value="">— none —</option>
                {relevantCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}{c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Merchant */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">Merchant</label>
              <input
                value={editForm.merchant}
                onChange={(e) => setEditForm((f) => ({ ...f, merchant: e.target.value }))}
                placeholder="optional"
                className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
              />
            </div>

            {/* Comment */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[rgb(var(--muted))]">Note</label>
              <input
                value={editForm.comment}
                onChange={(e) => setEditForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder="optional"
                className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm outline-none focus:border-[rgb(var(--accent))]"
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={saveEdit}
              disabled={saving || !editForm.amount}
              className="rounded-lg bg-[rgb(var(--foreground))] px-4 py-2 text-xs font-semibold text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              onClick={onEditToggle}
              className="rounded-lg border border-[rgb(var(--border))] px-4 py-2 text-xs text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface))]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
