"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
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

  const copy = {
    createRoot: locale === "ru" ? "Новая категория" : "New category",
    createSub: locale === "ru" ? "Новая подкатегория" : "New subcategory",
    edit: locale === "ru" ? "Редактирование" : "Editing",
    root: locale === "ru" ? "Без родителя" : "Root category",
    clear: locale === "ru" ? "Очистить" : "Clear",
    defaultBadge: locale === "ru" ? "системная" : "default",
  };

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
      if (editingId === id) resetForm(activeType);
      setCategories((prev) => prev.filter((category) => category.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const typedCategories = categories.filter((category) => category.type === activeType);
  const roots = typedCategories.filter((category) => !category.parentId);
  const childrenByParent = new Map<string, Category[]>();
  for (const category of typedCategories) {
    if (!category.parentId) continue;
    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category);
    childrenByParent.set(category.parentId, children);
  }

  const visibleRoots = roots.filter((root) => {
    const children = childrenByParent.get(root.id) ?? [];
    return categoryMatches(root, search) || children.some((child) => categoryMatches(child, search));
  });

  const parentOptions = roots.filter((category) => category.id !== editingId);
  const incomeCount = categories.filter((category) => category.type === "INCOME").length;
  const expenseCount = categories.filter((category) => category.type === "EXPENSE").length;

  return (
    <div className="luca-page-wide space-y-5">
      {loadError && (
        <div className="rounded-lg border border-[rgb(var(--negative-dim))] bg-[rgb(var(--negative-dim))] px-4 py-3 text-sm text-[rgb(var(--negative))]">
          {t("common.errorLoading")}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("categories.title")}</h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">{t("categories.subtitle")}</p>
        </div>
        <button
          onClick={() => resetForm(activeType)}
          className="flex h-10 items-center gap-2 rounded-lg bg-[rgb(var(--foreground))] px-4 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85"
        >
          <PlusIcon size={15} weight="bold" />
          {t("categories.add")}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <div className="luca-panel p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
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
                        "flex h-9 min-w-[132px] items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition",
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
                  onChange={(event) => setSearch(event.target.value)}
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

          <div className="luca-panel">
            {loading ? (
              <div className="space-y-px p-2">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-lg bg-[rgb(var(--surface-soft))]" />
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
                    onClick={() => resetForm(activeType)}
                    className="mt-4 flex h-9 items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-3 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))]"
                  >
                    <PlusIcon size={14} weight="bold" />
                    {t("categories.add")}
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[rgb(var(--border-soft))]">
                {visibleRoots.map((category) => {
                  const children = (childrenByParent.get(category.id) ?? []).filter((child) =>
                    categoryMatches(child, search)
                  );
                  const shouldShowChildren = expanded.has(category.id) || !!search;
                  return (
                    <div key={category.id}>
                      <CategoryRow
                        category={category}
                        childCount={(childrenByParent.get(category.id) ?? []).length}
                        isExpanded={shouldShowChildren}
                        isEditing={editingId === category.id}
                        deleteConfirmId={deleteConfirmId}
                        onToggle={() => toggleExpanded(category.id)}
                        onCreateChild={() => {
                          setExpanded((prev) => new Set(prev).add(category.id));
                          resetForm(activeType, category.id);
                        }}
                        onEdit={() => editCategory(category)}
                        onDeleteRequest={() => setDeleteConfirmId(category.id)}
                        onDeleteConfirm={() => deleteCategory(category.id)}
                        onDeleteCancel={() => setDeleteConfirmId(null)}
                        t={t}
                        copy={copy}
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
                              isEditing={editingId === child.id}
                              deleteConfirmId={deleteConfirmId}
                              onToggle={() => undefined}
                              onCreateChild={() => undefined}
                              onEdit={() => editCategory(child)}
                              onDeleteRequest={() => setDeleteConfirmId(child.id)}
                              onDeleteConfirm={() => deleteCategory(child.id)}
                              onDeleteCancel={() => setDeleteConfirmId(null)}
                              t={t}
                              copy={copy}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="luca-panel h-fit xl:sticky xl:top-6">
          <div className="border-b border-[rgb(var(--border-soft))] px-4 py-3">
            <div className="text-sm font-semibold">
              {editingId ? copy.edit : form.parentId ? copy.createSub : copy.createRoot}
            </div>
            <div className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              {getTypeLabel(form.type, t)}
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--muted))]">
                {t("categories.name")}
              </label>
              <input
                autoFocus
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={locale === "ru" ? "Например, продукты" : "For example, groceries"}
                className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              />
            </div>

            {!editingId && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--muted))]">
                  {t("transactions.filterAll")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["EXPENSE", "INCOME"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setActiveType(type);
                        setForm((prev) => ({ ...prev, type, parentId: "", color: type === "EXPENSE" ? "#dc2626" : "#16a34a" }));
                      }}
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

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--muted))]">
                {t("categories.parent")}
              </label>
              <select
                value={form.parentId}
                onChange={(event) => setForm((prev) => ({ ...prev, parentId: event.target.value }))}
                className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              >
                <option value="">{copy.root}</option>
                {parentOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon ? `${category.icon} ` : ""}{category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--muted))]">
                {t("categories.icon")}
              </label>
              <div className="grid grid-cols-10 gap-1.5">
                {ICON_PRESETS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setForm((prev) => ({ ...prev, icon }))}
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
                onChange={(event) => setForm((prev) => ({ ...prev, icon: event.target.value }))}
                placeholder={locale === "ru" ? "Или свой символ" : "Or custom symbol"}
                className="mt-2 h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[rgb(var(--muted))]">
                {t("categories.color")}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setForm((prev) => ({ ...prev, color }))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: color }}
                  >
                    {form.color === color && <CheckIcon size={11} weight="bold" className="text-white drop-shadow" />}
                  </button>
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
                  className="h-7 w-9 cursor-pointer rounded-lg border border-[rgb(var(--border))] bg-transparent"
                />
              </div>
            </div>

            <div className="rounded-lg border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] p-3">
              <div className="mb-2 text-xs font-semibold text-[rgb(var(--muted))]">
                {t("categories.previewLabel")}
              </div>
              <div className="flex items-center gap-3">
                <CategoryMark category={{ icon: form.icon, color: form.color }} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{form.name || t("categories.name")}</div>
                  <div className="text-xs text-[rgb(var(--muted))]">
                    {form.parentId ? copy.createSub : copy.root}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveCategory}
                disabled={saving || !form.name.trim()}
                className="h-10 flex-1 rounded-lg bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
              >
                {saving ? t("common.loading") : t("common.save")}
              </button>
              <button
                onClick={() => resetForm(activeType)}
                className="h-10 rounded-lg border border-[rgb(var(--border))] px-4 text-sm font-medium text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
              >
                {copy.clear}
              </button>
            </div>
          </div>
        </aside>
      </div>
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
  onToggle,
  onCreateChild,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  t,
  copy,
}: {
  category: Category;
  childCount: number;
  nested?: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  deleteConfirmId: string | null;
  onToggle: () => void;
  onCreateChild: () => void;
  onEdit: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  t: (key: string) => string;
  copy: { defaultBadge: string };
}) {
  const confirmingDelete = deleteConfirmId === category.id;

  return (
    <div
      className={[
        "flex items-center gap-3 px-3 py-2.5 transition",
        nested ? "rounded-lg" : "",
        isEditing ? "bg-[rgb(var(--accent-dim))]" : "hover:bg-[rgb(var(--surface-soft))]",
      ].join(" ")}
    >
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

      <CategoryMark category={category} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-[rgb(var(--foreground))]">
            {category.name}
          </span>
          {category.isDefault && (
            <span className="shrink-0 rounded-full bg-[rgb(var(--surface-soft))] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--muted))]">
              {copy.defaultBadge}
            </span>
          )}
        </div>
        <div className="text-xs text-[rgb(var(--muted))]">
          {nested ? t("categories.sub") : childCount > 0 ? `${childCount} ${t("categories.subcategories")}` : t("categories.noParent")}
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
      ) : (
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
          {!category.isDefault && (
            <button
              onClick={onDeleteRequest}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
              title={t("common.delete")}
            >
              <TrashIcon size={14} weight="bold" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
