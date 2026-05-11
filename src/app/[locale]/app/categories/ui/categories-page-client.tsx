"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";

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
  type: "INCOME" | "EXPENSE";
  icon: string;
  color: string;
  parentId: string;
};

const defaultForm: CategoryForm = {
  name: "",
  type: "EXPENSE",
  icon: "",
  color: "#6366f1",
  parentId: "",
};

// ─── Emoji picker data ────────────────────────────────────────────────────────
const EMOJI_GROUPS = [
  { label: "Food", emojis: ["🍕","🍔","🍣","🍜","🍺","☕","🛒","🥗","🍰","🥤","🍱","🍦"] },
  { label: "Transport", emojis: ["🚗","🚕","✈️","🚂","🚌","🛵","🚲","⛽","🅿️","🛫","🚀","⚓"] },
  { label: "Home", emojis: ["🏠","🛋️","💡","🔧","🏗️","🧹","🛏️","🚿","📦","🔑","🏡","🌿"] },
  { label: "Health", emojis: ["💊","🏥","🩺","🧘","🏃","💪","🦷","👓","🩻","💉","🧬","❤️"] },
  { label: "Shopping", emojis: ["👕","👟","💄","🎒","💍","👜","🛍️","🧴","💻","📱","⌚","🎨"] },
  { label: "Money", emojis: ["💰","💵","💳","📈","🏦","💸","🏆","🎁","💼","📊","🪙","🤑"] },
  { label: "Fun", emojis: ["🎮","🎬","🎵","📚","🎲","🎭","🎸","🎾","⛷️","🏖️","🎡","🎪"] },
  { label: "Other", emojis: ["📝","📋","🔔","📞","🌐","🎓","✈️","🌙","⭐","🔥","✅","❓"] },
];

// ─── Color swatches ───────────────────────────────────────────────────────────
const COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
  "#78716c", "#64748b", "#0f172a", "#fbbf24",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm transition hover:bg-[rgb(var(--surface))]"
      >
        {value ? (
          <span className="text-lg leading-none">{value}</span>
        ) : (
          <span className="text-[rgb(var(--muted))]">Pick emoji…</span>
        )}
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="ml-auto text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]"
          >
            <XIcon size={12} />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-xl">
          <div className="max-h-64 overflow-y-auto p-3 space-y-3">
            {EMOJI_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted-soft))]">
                  {group.label}
                </div>
                <div className="grid grid-cols-8 gap-0.5">
                  {group.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => { onChange(emoji); setOpen(false); }}
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-[rgb(var(--surface-soft))]",
                        value === emoji ? "bg-[rgb(var(--accent)/0.12)] ring-1 ring-[rgb(var(--accent))]" : "",
                      ].join(" ")}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-1.5">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className="group relative flex h-7 w-7 items-center justify-center rounded-lg transition hover:scale-110"
            style={{ background: color }}
          >
            {value === color && (
              <CheckIcon size={12} weight="bold" className="text-white drop-shadow" />
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded-md border border-[rgb(var(--border))] bg-transparent p-0"
        />
        <span className="text-xs font-mono text-[rgb(var(--muted))]">{value}</span>
      </div>
    </div>
  );
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  isEditing,
  editForm,
  onEditFormChange,
  deleteConfirm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  parentOptions,
  saving,
  t,
}: {
  category: Category;
  isEditing: boolean;
  editForm: CategoryForm;
  onEditFormChange: (patch: Partial<CategoryForm>) => void;
  deleteConfirm: boolean;
  onStartEdit: (c: Category) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDeleteRequest: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
  parentOptions: Category[];
  saving: boolean;
  t: (key: string) => string;
}) {
  const bg = category.color ?? "#6366f1";
  const hasIcon = !!category.icon;

  if (isEditing) {
    return (
      <div className="col-span-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t("common.edit")}: {category.name}</span>
          <button
            onClick={onCancelEdit}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
          >
            <XIcon size={13} />
          </button>
        </div>
        <CategoryFormFields form={editForm} onChange={onEditFormChange} parentOptions={parentOptions} t={t} />
        <div className="flex gap-2">
          <button
            onClick={() => onSaveEdit(category.id)}
            disabled={saving || !editForm.name}
            className="flex-1 rounded-lg bg-[rgb(var(--foreground))] py-2.5 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
          >
            {saving ? t("common.loading") : t("common.save")}
          </button>
          <button
            onClick={onCancelEdit}
            className="rounded-lg border border-[rgb(var(--border))] px-4 py-2.5 text-sm text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 transition hover:border-[rgb(var(--border-soft))] hover:shadow-sm">
      {/* Color stripe */}
      <div
        className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
        style={{ background: bg }}
      />

      {/* Icon */}
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-xl"
        style={{ background: hasIcon ? "rgb(var(--surface-soft))" : bg + "22" }}
      >
        {hasIcon ? (
          <span className="leading-none">{category.icon}</span>
        ) : (
          <div className="h-4 w-4 rounded-full" style={{ background: bg }} />
        )}
      </div>

      {/* Name */}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-[rgb(var(--foreground))]">
          {category.name}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {category.isDefault && (
            <span className="rounded bg-[rgb(var(--accent)/0.1)] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[rgb(var(--accent))]">
              Default
            </span>
          )}
          {category.parentId && (
            <span className="text-[10px] text-[rgb(var(--muted-soft))]">subcategory</span>
          )}
        </div>
      </div>

      {/* Actions — appear on hover */}
      {deleteConfirm ? (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-[rgb(var(--negative-dim))] px-2 py-1.5">
          <span className="text-[10px] font-medium text-[rgb(var(--negative))]">Delete?</span>
          <div className="flex gap-1">
            <button
              onClick={() => onDeleteConfirm(category.id)}
              className="flex h-5 w-5 items-center justify-center rounded-md bg-[rgb(var(--negative))] text-white hover:opacity-80"
            >
              <CheckIcon size={9} weight="bold" />
            </button>
            <button
              onClick={onDeleteCancel}
              className="flex h-5 w-5 items-center justify-center rounded-md text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]"
            >
              <XIcon size={9} />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onStartEdit(category)}
            className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
          >
            <PencilIcon size={11} weight="bold" />
            <span className="text-[10px] font-medium">Edit</span>
          </button>
          {!category.isDefault && (
            <button
              onClick={() => onDeleteRequest(category.id)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))] transition hover:border-[rgb(var(--negative-dim))] hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
            >
              <TrashIcon size={11} weight="bold" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Form fields ──────────────────────────────────────────────────────────────

function CategoryFormFields({
  form,
  onChange,
  parentOptions,
  t,
}: {
  form: CategoryForm;
  onChange: (patch: Partial<CategoryForm>) => void;
  parentOptions: Category[];
  t: (key: string) => string;
}) {
  return (
    <>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
          {t("categories.name")}
        </label>
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Groceries"
          className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
            {t("categories.icon")}
          </label>
          <EmojiPicker value={form.icon} onChange={(v) => onChange({ icon: v })} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
            Color preview
          </label>
          <div
            className="flex h-10 items-center justify-center rounded-lg text-sm font-medium text-white"
            style={{ background: form.color || "#6366f1" }}
          >
            {form.name || "Preview"}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
          {t("categories.color")}
        </label>
        <ColorPicker value={form.color} onChange={(v) => onChange({ color: v })} />
      </div>

      {parentOptions.length > 0 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
            {t("categories.parent")}
          </label>
          <select
            value={form.parentId}
            onChange={(e) => onChange({ parentId: e.target.value })}
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          >
            <option value="">{t("categories.noParent")}</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}{c.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CategoriesPageClient() {
  const { t } = useI18n();
  const { workspace } = useLuca();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CategoryForm>(defaultForm);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(defaultForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function loadCategories() {
    if (!workspace) return;
    setLoading(true);
    apiFetch<{ categories: Category[] }>(`/api/categories?workspaceId=${workspace.id}`)
      .then((r) => setCategories(r.categories))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadCategories(); }, [workspace]);

  async function createCategory() {
    if (!workspace || !form.name) return;
    setSaving(true);
    try {
      await apiFetch<{ category: Category }>("/api/categories", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: form.name,
          type: form.type,
          icon: form.icon || null,
          color: form.color || null,
          parentId: form.parentId || null,
        }),
      });
      setForm(defaultForm);
      setShowForm(false);
      loadCategories();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      type: category.type === "TRANSFER" ? "EXPENSE" : category.type,
      icon: category.icon ?? "",
      color: category.color ?? "#6366f1",
      parentId: category.parentId ?? "",
    });
    setDeleteConfirmId(null);
    setShowForm(false);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await apiFetch<{ category: Category }>(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          icon: editForm.icon || null,
          color: editForm.color || null,
          parentId: editForm.parentId || null,
        }),
      });
      setEditingId(null);
      loadCategories();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function deleteCategory(id: string) {
    try {
      await apiFetch(`/api/categories/${id}`, { method: "DELETE" });
      setDeleteConfirmId(null);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) { console.error(err); }
  }

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");
  const incomeCategories = categories.filter((c) => c.type === "INCOME");
  const parentOptions = (type: "INCOME" | "EXPENSE") =>
    categories.filter((c) => c.type === type && !c.parentId);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("categories.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("categories.subtitle")}</p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setEditingId(null); }}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.97]"
        >
          {showForm ? <XIcon size={14} weight="bold" /> : <PlusIcon size={14} weight="bold" />}
          {t("categories.add")}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border-soft))] px-5 py-3.5">
            <span className="text-sm font-semibold">{t("categories.add")}</span>
            <button
              onClick={() => setShowForm(false)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
            >
              <XIcon size={13} />
            </button>
          </div>
          <div className="space-y-4 p-5">
            {/* Type selector */}
            <div className="flex gap-2">
              {(["EXPENSE", "INCOME"] as const).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setForm((f) => ({ ...f, type: tp, parentId: "" }))}
                  className={[
                    "flex-1 rounded-lg border py-2 text-sm font-medium transition",
                    form.type === tp
                      ? tp === "EXPENSE"
                        ? "border-[rgb(var(--negative))] bg-[rgb(var(--negative-dim))] text-[rgb(var(--negative))]"
                        : "border-[rgb(var(--positive))] bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]"
                      : "border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]",
                  ].join(" ")}
                >
                  {tp === "EXPENSE" ? t("categories.expense") : t("categories.income")}
                </button>
              ))}
            </div>

            <CategoryFormFields
              form={form}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              parentOptions={parentOptions(form.type)}
              t={t}
            />

            <button
              onClick={createCategory}
              disabled={saving || !form.name}
              className="h-10 w-full rounded-lg bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
            >
              {saving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      )}

      {/* Lists */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-20 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--surface-soft))]">
            <span className="text-2xl opacity-30">🏷️</span>
          </div>
          <p className="text-sm text-[rgb(var(--muted))]">{t("categories.empty")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[
            { label: t("categories.expense"), items: expenseCategories, type: "EXPENSE" as const },
            { label: t("categories.income"), items: incomeCategories, type: "INCOME" as const },
          ].map(({ label, items, type }) => {
            if (items.length === 0) return null;

            const roots = items.filter((c) => !c.parentId);
            const subs = items.filter((c) => c.parentId);

            return (
              <div key={type}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
                    {label}
                  </span>
                  <span className="text-xs text-[rgb(var(--muted-soft))]">
                    ({items.length})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {/* If editing: the edit card spans full width */}
                  {roots.map((cat) => (
                    <CategoryCard
                      key={cat.id}
                      category={cat}
                      isEditing={editingId === cat.id}
                      editForm={editForm}
                      onEditFormChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                      deleteConfirm={deleteConfirmId === cat.id}
                      onStartEdit={startEdit}
                      onSaveEdit={saveEdit}
                      onCancelEdit={() => setEditingId(null)}
                      onDeleteRequest={(id) => { setDeleteConfirmId((p) => (p === id ? null : id)); setEditingId(null); }}
                      onDeleteConfirm={deleteCategory}
                      onDeleteCancel={() => setDeleteConfirmId(null)}
                      parentOptions={parentOptions(type)}
                      saving={saving}
                      t={t}
                    />
                  ))}
                </div>

                {/* Subcategories as a compact list */}
                {subs.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
                    <div className="border-b border-[rgb(var(--border-soft))] px-4 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted-soft))]">
                        Subcategories
                      </span>
                    </div>
                    {subs.map((cat, idx) => {
                      const parent = items.find((c) => c.id === cat.parentId);
                      return (
                        <div
                          key={cat.id}
                          className={[
                            "group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[rgb(var(--surface-soft))]",
                            idx < subs.length - 1 ? "border-b border-[rgb(var(--border-soft))]" : "",
                          ].join(" ")}
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                            style={{ background: (cat.color ?? "#6366f1") + "22" }}
                          >
                            {cat.icon ?? <div className="h-3 w-3 rounded-full" style={{ background: cat.color ?? "#6366f1" }} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-[rgb(var(--foreground))]">{cat.name}</span>
                            {parent && (
                              <span className="ml-1.5 text-xs text-[rgb(var(--muted-soft))]">↳ {parent.name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => startEdit(cat)}
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface))] hover:text-[rgb(var(--foreground))]"
                            >
                              <PencilIcon size={11} weight="bold" />
                            </button>
                            <button
                              onClick={() => { setDeleteConfirmId((p) => (p === cat.id ? null : cat.id)); setEditingId(null); }}
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
                            >
                              <TrashIcon size={11} weight="bold" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {editingId && subs.find((s) => s.id === editingId) && (
                  <div className="mt-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{t("common.edit")}</span>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]"
                      >
                        <XIcon size={13} />
                      </button>
                    </div>
                    <CategoryFormFields form={editForm} onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))} parentOptions={parentOptions(type)} t={t} />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(editingId)}
                        disabled={saving || !editForm.name}
                        className="flex-1 rounded-lg bg-[rgb(var(--foreground))] py-2.5 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
                      >
                        {saving ? t("common.loading") : t("common.save")}
                      </button>
                      <button onClick={() => setEditingId(null)} className="rounded-lg border border-[rgb(var(--border))] px-4 py-2.5 text-sm text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]">
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
