"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { Modal } from "@/shared/ui/modal";
import {
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  CheckSquareIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  SquareIcon,
  TagIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";

type Category = {
  id: string;
  workspaceId: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  icon?: string | null;
  color?: string | null;
  isDefault: boolean;
  parentId?: string | null;
};

type CategoryForm = {
  name: string;
  type: "EXPENSE" | "INCOME";
  icon: string;
  color: string;
  parentId: string;
};

const EMPTY_FORM: CategoryForm = {
  name: "",
  type: "EXPENSE",
  icon: "",
  color: "#0e7490",
  parentId: "",
};

const ICON_PRESETS = [
  "🍔", "🛒", "☕", "🚕", "✈️", "🏠", "💡", "💊", "👕", "🎮", "📚", "💳",
  "💰", "📈", "🏦", "💼", "🎁", "🧾", "🔧", "🏷️",
];

const COLOR_PRESETS = [
  "#dc2626", "#ea580c", "#d97706", "#65a30d", "#16a34a", "#059669",
  "#0e7490", "#2563eb", "#4f46e5", "#7c3aed", "#c026d3", "#db2777",
  "#475569", "#18181b",
];

function categoryMatches(category: Category, search: string) {
  return !search || category.name.toLowerCase().includes(search.toLowerCase());
}

function getTypeLabel(type: "EXPENSE" | "INCOME", t: (key: string) => string) {
  return type === "EXPENSE" ? t("categories.expense") : t("categories.income");
}

/* ── Category form (shared between side panel and modal) ── */
function CategoryFormContent({
  form,
  editingId,
  parentOptions,
  saving,
  locale,
  onChange,
  onSave,
  onClear,
  t,
}: {
  form: CategoryForm;
  editingId: string | null;
  parentOptions: Category[];
  saving: boolean;
  locale: string;
  onChange: (patch: Partial<CategoryForm>) => void;
  onSave: () => void;
  onClear: () => void;
  t: (key: string) => string;
}) {
  const copy = {
    createRoot: locale === "ru" ? "Новая категория" : "New category",
    createSub: locale === "ru" ? "Новая подкатегория" : "New subcategory",
    edit: locale === "ru" ? "Редактирование" : "Editing",
    root: locale === "ru" ? "Без родителя" : "Root category",
    clear: locale === "ru" ? "Очистить" : "Clear",
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--muted))]">
          {t("categories.name")}
        </label>
        <input
          autoFocus
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
          placeholder={locale === "ru" ? "Например, продукты" : "e.g. Groceries"}
          className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </div>

      {/* Type (create only) */}
      {!editingId && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--muted))]">
            {t("transactions.filterAll")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["EXPENSE", "INCOME"] as const).map((type) => (
              <button
                key={type}
                onClick={() => onChange({ type, parentId: "", color: type === "EXPENSE" ? "#dc2626" : "#16a34a" })}
                className={[
                  "h-9 rounded-lg border text-sm font-medium transition",
                  form.type === type
                    ? "border-[rgb(var(--foreground))] bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                    : "border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]",
                ].join(" ")}
              >
                {getTypeLabel(type, t)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Parent category */}
      {parentOptions.length > 0 && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--muted))]">
            {t("categories.parent")}
          </label>
          <select
            value={form.parentId}
            onChange={(e) => onChange({ parentId: e.target.value })}
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          >
            <option value="">{copy.root}</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}{c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Icon */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--muted))]">
          {t("categories.icon")}
        </label>
        <div className="grid grid-cols-10 gap-1.5">
          {ICON_PRESETS.map((icon) => (
            <button
              key={icon}
              onClick={() => onChange({ icon })}
              className={[
                "flex h-8 items-center justify-center rounded-lg border text-base transition hover:bg-[rgb(var(--surface-soft))]",
                form.icon === icon
                  ? "border-[rgb(var(--foreground))] bg-[rgb(var(--surface-soft))]"
                  : "border-[rgb(var(--border-soft))]",
              ].join(" ")}
            >
              {icon}
            </button>
          ))}
        </div>
        <input
          value={form.icon}
          onChange={(e) => onChange({ icon: e.target.value })}
          placeholder={locale === "ru" ? "Или свой символ" : "Or custom symbol"}
          className="mt-2 h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </div>

      {/* Color */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--muted))]">
          {t("categories.color")}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              onClick={() => onChange({ color })}
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: color }}
            >
              {form.color === color && <CheckIcon size={11} weight="bold" className="text-white drop-shadow" />}
            </button>
          ))}
          <input
            type="color"
            value={form.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-7 w-9 cursor-pointer rounded-lg border border-[rgb(var(--border))] bg-transparent"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] p-3">
        <div className="mb-2 text-xs font-semibold text-[rgb(var(--muted))]">
          {t("categories.previewLabel")}
        </div>
        <div className="flex items-center gap-3">
          <CategoryMark category={{ icon: form.icon, color: form.color }} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{form.name || t("categories.name")}</div>
            <div className="text-xs text-[rgb(var(--muted))]">
              {form.parentId ? (locale === "ru" ? "Подкатегория" : "Subcategory") : (locale === "ru" ? "Корневая" : "Root")}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="h-10 flex-1 rounded-lg bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
        >
          {saving ? t("common.loading") : t("common.save")}
        </button>
        <button
          onClick={onClear}
          className="h-10 rounded-lg border border-[rgb(var(--border))] px-4 text-sm font-medium text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
        >
          {copy.clear}
        </button>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────── */
export function CategoriesPageClient() {
  const { t, locale } = useI18n();
  const { workspace } = useLuca();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeType, setActiveType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  function loadCategories() {
    if (!workspace) return;
    setLoading(true);
    setLoadError(false);
    apiFetch<{ categories: Category[] }>(`/api/categories?workspaceId=${workspace.id}`)
      .then((r) => {
        setCategories(r.categories);
        setExpanded(new Set(r.categories.filter((c) => !c.parentId).map((c) => c.id)));
      })
      .catch((err) => {
        console.error(err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCategories();
  }, [workspace]);

  function resetForm(type: "EXPENSE" | "INCOME" = activeType, parentId = "") {
    setEditingId(null);
    setDeleteConfirmId(null);
    setForm({ ...EMPTY_FORM, type, parentId, color: type === "EXPENSE" ? "#dc2626" : "#16a34a" });
  }

  function openCreate(type: "EXPENSE" | "INCOME" = activeType, parentId = "") {
    resetForm(type, parentId);
    setFormOpen(true);
  }

  function editCategory(category: Category) {
    const type = category.type === "INCOME" ? "INCOME" : "EXPENSE";
    setActiveType(type);
    setEditingId(category.id);
    setDeleteConfirmId(null);
    setForm({
      name: category.name,
      type,
      icon: category.icon ?? "",
      color: category.color ?? (type === "EXPENSE" ? "#dc2626" : "#16a34a"),
      parentId: category.parentId ?? "",
    });
    setFormOpen(true);
  }

  async function saveCategory() {
    if (!workspace || !form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await apiFetch(`/api/categories/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name.trim(),
            icon: form.icon || null,
            color: form.color || null,
            parentId: form.parentId || null,
          }),
        });
      } else {
        await apiFetch("/api/categories", {
          method: "POST",
          body: JSON.stringify({
            workspaceId: workspace.id,
            name: form.name.trim(),
            type: form.type,
            icon: form.icon || null,
            color: form.color || null,
            parentId: form.parentId || null,
          }),
        });
      }
      setFormOpen(false);
      resetForm(form.type);
      loadCategories();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id: string) {
    try {
      await apiFetch(`/api/categories/${id}`, { method: "DELETE" });
      setDeleteConfirmId(null);
      if (editingId === id) { resetForm(activeType); setFormOpen(false); }
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  async function bulkDeleteCategories(ids: string[]) {
    if (!workspace || ids.length === 0) return;
    setBulkDeleting(true);
    try {
      await apiFetch("/api/categories/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ workspaceId: workspace.id, ids }),
      });
      setSelectedIds(new Set());
      setSelectionMode(false);
      setDeleteAllConfirm(false);
      loadCategories();
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

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const typedCategories = categories.filter((c) => c.type === activeType);
  const roots = typedCategories.filter((c) => !c.parentId);
  const childrenByParent = new Map<string, Category[]>();
  for (const c of typedCategories) {
    if (!c.parentId) continue;
    const arr = childrenByParent.get(c.parentId) ?? [];
    arr.push(c);
    childrenByParent.set(c.parentId, arr);
  }

  const visibleRoots = roots.filter((root) => {
    const children = childrenByParent.get(root.id) ?? [];
    return categoryMatches(root, search) || children.some((ch) => categoryMatches(ch, search));
  });

  const parentOptions = roots.filter((c) => c.id !== editingId);
  const incomeCount = categories.filter((c) => c.type === "INCOME").length;
  const expenseCount = categories.filter((c) => c.type === "EXPENSE").length;

  const formTitle = editingId
    ? (locale === "ru" ? "Редактировать" : "Edit category")
    : form.parentId
      ? (locale === "ru" ? "Новая подкатегория" : "New subcategory")
      : (locale === "ru" ? "Новая категория" : "New category");

  return (
    <div className="luca-page-wide space-y-5">
      {loadError && (
        <div className="rounded-lg border border-[rgb(var(--negative-dim))] bg-[rgb(var(--negative-dim))] px-4 py-3 text-sm text-[rgb(var(--negative))]">
          {t("common.errorLoading")}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("categories.title")}</h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">{t("categories.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {!selectionMode && (
            <button
              onClick={() => { setDeleteAllConfirm(true); }}
              className="flex h-10 items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-4 text-sm font-medium text-[rgb(var(--negative))] transition hover:bg-[rgb(var(--negative-dim))]"
            >
              <TrashIcon size={14} weight="bold" />
              {locale === "ru" ? "Удалить все" : "Delete all"}
            </button>
          )}
          <button
            onClick={() => {
              setSelectionMode((v) => !v);
              setSelectedIds(new Set());
            }}
            className={[
              "flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition",
              selectionMode
                ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent-dim))] text-[rgb(var(--accent))]"
                : "border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]",
            ].join(" ")}
          >
            {selectionMode ? <CheckSquareIcon size={15} weight="bold" /> : <SquareIcon size={15} />}
            {locale === "ru" ? "Выбрать" : "Select"}
          </button>
          {!selectionMode && (
            <button
              onClick={() => openCreate(activeType)}
              className="flex h-10 items-center gap-2 rounded-lg bg-[rgb(var(--foreground))] px-4 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85"
            >
              <PlusIcon size={15} weight="bold" />
              {t("categories.add")}
            </button>
          )}
        </div>
      </div>

      {/* Delete all confirmation */}
      {deleteAllConfirm && (
        <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--negative-dim))] bg-[rgb(var(--negative-dim))] px-4 py-3">
          <span className="text-sm font-medium text-[rgb(var(--negative))]">
            {locale === "ru"
              ? `Удалить все ${activeType === "EXPENSE" ? "расходные" : "доходные"} категории? Транзакции потеряют категорию.`
              : `Delete all ${activeType === "EXPENSE" ? "expense" : "income"} categories? Transactions will lose their category.`}
          </span>
          <div className="flex shrink-0 items-center gap-2 ml-4">
            <button
              onClick={() => bulkDeleteCategories(visibleRoots.flatMap((r) => [r.id, ...(childrenByParent.get(r.id) ?? []).map((c) => c.id)]))}
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

      {/* Type tabs + search */}
      <div className="luca-panel p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex rounded-lg bg-[rgb(var(--surface-soft))] p-1">
            {(["EXPENSE", "INCOME"] as const).map((type) => {
              const active = activeType === type;
              const count = type === "EXPENSE" ? expenseCount : incomeCount;
              return (
                <button
                  key={type}
                  onClick={() => {
                    setActiveType(type);
                    resetForm(type);
                  }}
                  className={[
                    "flex h-9 min-w-[120px] items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition",
                    active
                      ? "bg-[rgb(var(--surface))] text-[rgb(var(--foreground))] shadow-sm"
                      : "text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]",
                  ].join(" ")}
                >
                  {getTypeLabel(type, t)}
                  <span className="rounded-full bg-[rgb(var(--surface-soft))] px-1.5 py-0.5 text-[10px] font-semibold text-[rgb(var(--muted))]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("categories.search")}
              className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] pl-9 pr-9 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]"
              >
                <XIcon size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main layout: list + desktop side panel */}
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-4">
        {/* Category list */}
        <div className="luca-panel">
          {loading ? (
            <div className="space-y-px p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-[rgb(var(--surface-soft))]" />
              ))}
            </div>
          ) : visibleRoots.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <TagIcon size={28} className="text-[rgb(var(--muted-soft))]" />
              <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                {search ? t("categories.noResults") : t("categories.empty")}
              </p>
              {!search && (
                <button
                  onClick={() => openCreate(activeType)}
                  className="mt-4 flex h-9 items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-3 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))]"
                >
                  <PlusIcon size={14} weight="bold" />
                  {t("categories.add")}
                </button>
              )}
            </div>
          ) : (
            <>
            <div className="divide-y divide-[rgb(var(--border-soft))]">
              {visibleRoots.map((category) => {
                const children = (childrenByParent.get(category.id) ?? []).filter((ch) =>
                  categoryMatches(ch, search)
                );
                const shouldShowChildren = expanded.has(category.id) || !!search;
                return (
                  <div key={category.id}>
                    <CategoryRow
                      category={category}
                      childCount={(childrenByParent.get(category.id) ?? []).length}
                      isExpanded={shouldShowChildren}
                      isEditing={editingId === category.id && !formOpen}
                      deleteConfirmId={deleteConfirmId}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(category.id)}
                      onToggleSelect={() => toggleSelect(category.id)}
                      onToggle={() => toggleExpanded(category.id)}
                      onCreateChild={() => {
                        setExpanded((prev) => new Set(prev).add(category.id));
                        openCreate(activeType, category.id);
                      }}
                      onEdit={() => editCategory(category)}
                      onDeleteRequest={() => setDeleteConfirmId(category.id)}
                      onDeleteConfirm={() => deleteCategory(category.id)}
                      onDeleteCancel={() => setDeleteConfirmId(null)}
                      t={t}
                      locale={locale}
                    />
                    {shouldShowChildren && children.length > 0 && (
                      <div className="bg-[rgb(var(--surface-soft))] py-1 pl-12 pr-2">
                        {children.map((child) => (
                          <CategoryRow
                            key={child.id}
                            category={child}
                            childCount={0}
                            nested
                            isExpanded={false}
                            isEditing={editingId === child.id && !formOpen}
                            deleteConfirmId={deleteConfirmId}
                            selectionMode={selectionMode}
                            isSelected={selectedIds.has(child.id)}
                            onToggleSelect={() => toggleSelect(child.id)}
                            onToggle={() => undefined}
                            onCreateChild={() => undefined}
                            onEdit={() => editCategory(child)}
                            onDeleteRequest={() => setDeleteConfirmId(child.id)}
                            onDeleteConfirm={() => deleteCategory(child.id)}
                            onDeleteCancel={() => setDeleteConfirmId(null)}
                            t={t}
                            locale={locale}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {selectionMode && (
              <div className="flex items-center justify-between border-t border-[rgb(var(--border-soft))] bg-[rgb(var(--surface))] px-4 py-3">
                <span className="text-sm text-[rgb(var(--muted))]">
                  {selectedIds.size > 0
                    ? (locale === "ru" ? `Выбрано: ${selectedIds.size}` : `Selected: ${selectedIds.size}`)
                    : (locale === "ru" ? "Выберите категории" : "Select categories")}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const allIds = visibleRoots.flatMap((r) => [r.id, ...(childrenByParent.get(r.id) ?? []).map((c) => c.id)]);
                      const allSelected = allIds.every((id) => selectedIds.has(id));
                      setSelectedIds(allSelected ? new Set() : new Set(allIds));
                    }}
                    className="h-8 rounded-lg border border-[rgb(var(--border))] px-3 text-xs font-medium text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
                  >
                    {locale === "ru" ? "Выбрать все" : "Select all"}
                  </button>
                  <button
                    onClick={() => bulkDeleteCategories(Array.from(selectedIds))}
                    disabled={selectedIds.size === 0 || bulkDeleting}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-[rgb(var(--negative))] px-3 text-xs font-medium text-white disabled:opacity-40"
                  >
                    <TrashIcon size={12} weight="bold" />
                    {locale === "ru" ? `Удалить (${selectedIds.size})` : `Delete (${selectedIds.size})`}
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>

        {/* Desktop side panel (xl+) */}
        <aside className="hidden xl:block">
          <div className="luca-panel h-fit sticky top-6">
            <div className="border-b border-[rgb(var(--border-soft))] px-4 py-3">
              <div className="text-sm font-semibold">{formTitle}</div>
              <div className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                {getTypeLabel(form.type, t)}
              </div>
            </div>
            <div className="p-4">
              <CategoryFormContent
                form={form}
                editingId={editingId}
                parentOptions={parentOptions}
                saving={saving}
                locale={locale}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                onSave={saveCategory}
                onClear={() => { resetForm(activeType); setFormOpen(false); }}
                t={t}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile modal (below xl) */}
      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); resetForm(activeType); }}
        title={formTitle}
        maxWidth="sm"
      >
        <CategoryFormContent
          form={form}
          editingId={editingId}
          parentOptions={parentOptions}
          saving={saving}
          locale={locale}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onSave={saveCategory}
          onClear={() => { setFormOpen(false); resetForm(activeType); }}
          t={t}
        />
      </Modal>
    </div>
  );
}

function CategoryMark({ category }: { category: Pick<Category, "icon" | "color"> }) {
  const color = category.color || "#0e7490";
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
      style={{ background: `${color}20`, color }}
    >
      {category.icon ? (
        <span className="leading-none">{category.icon}</span>
      ) : (
        <TagIcon size={16} weight="bold" />
      )}
    </div>
  );
}

function CategoryRow({
  category,
  childCount,
  nested = false,
  isExpanded,
  isEditing,
  deleteConfirmId,
  selectionMode,
  isSelected,
  onToggleSelect,
  onToggle,
  onCreateChild,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  t,
  locale,
}: {
  category: Category;
  childCount: number;
  nested?: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  deleteConfirmId: string | null;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggle: () => void;
  onCreateChild: () => void;
  onEdit: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  t: (key: string) => string;
  locale: string;
}) {
  const confirmingDelete = deleteConfirmId === category.id;
  const defaultBadge = locale === "ru" ? "системная" : "default";

  return (
    <div
      className={[
        "flex items-center gap-3 px-3 py-2.5 transition",
        nested ? "rounded-lg" : "",
        isEditing ? "bg-[rgb(var(--accent-dim))]" : "hover:bg-[rgb(var(--surface-soft))]",
        selectionMode && isSelected ? "bg-[rgb(var(--accent-dim))]" : "",
      ].join(" ")}
    >
      {selectionMode ? (
        <button
          onClick={onToggleSelect}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--accent))] transition hover:bg-[rgb(var(--surface))]"
        >
          {isSelected ? <CheckSquareIcon size={18} weight="fill" /> : <SquareIcon size={18} />}
        </button>
      ) : (
        <button
          onClick={childCount > 0 ? onToggle : onCreateChild}
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface))] hover:text-[rgb(var(--foreground))]",
            nested ? "invisible" : "",
          ].join(" ")}
          title={childCount > 0 ? undefined : t("categories.addSub")}
        >
          {childCount > 0 ? (
            isExpanded ? <CaretDownIcon size={13} weight="bold" /> : <CaretRightIcon size={13} weight="bold" />
          ) : (
            <PlusIcon size={13} weight="bold" />
          )}
        </button>
      )}

      <CategoryMark category={category} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-[rgb(var(--foreground))]">
            {category.name}
          </span>
          {category.isDefault && (
            <span className="shrink-0 rounded-full bg-[rgb(var(--surface-soft))] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--muted))]">
              {defaultBadge}
            </span>
          )}
        </div>
        <div className="text-xs text-[rgb(var(--muted))]">
          {nested
            ? t("categories.sub")
            : childCount > 0
              ? `${childCount} ${t("categories.subcategories")}`
              : t("categories.noParent")}
        </div>
      </div>

      {confirmingDelete ? (
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden text-xs text-[rgb(var(--negative))] sm:inline">
            {t("categories.deleteConfirm")}
          </span>
          <button
            onClick={onDeleteConfirm}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--negative))] text-white"
          >
            <CheckIcon size={12} weight="bold" />
          </button>
          <button
            onClick={onDeleteCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface))]"
          >
            <XIcon size={12} />
          </button>
        </div>
      ) : !selectionMode && (
        <div className="flex shrink-0 items-center gap-1">
          {!nested && (
            <button
              onClick={onCreateChild}
              className="hidden h-8 items-center gap-1 rounded-lg border border-[rgb(var(--border))] px-2 text-xs font-medium text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface))] hover:text-[rgb(var(--foreground))] sm:flex"
            >
              <PlusIcon size={12} weight="bold" />
              {t("categories.sub")}
            </button>
          )}
          <button
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface))] hover:text-[rgb(var(--foreground))]"
            title={t("common.edit")}
          >
            <PencilSimpleIcon size={14} weight="bold" />
          </button>
          <button
            onClick={onDeleteRequest}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
            title={t("common.delete")}
          >
            <TrashIcon size={14} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}
