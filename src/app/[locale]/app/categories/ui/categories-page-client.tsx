"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { Modal } from "@/shared/ui/modal";
import {
  CheckIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
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

// ─── Emoji data ────────────────────────────────────────────────────────────────

const EMOJI_GROUPS = [
  { label: "Food", emojis: ["🍕","🍔","🍣","🍜","🍺","☕","🛒","🥗","🍰","🥤","🍱","🍦","🌮","🥩","🍷","🧁"] },
  { label: "Transport", emojis: ["🚗","🚕","✈️","🚂","🚌","🛵","🚲","⛽","🅿️","🛫","🚀","⚓","🚁","🛳️","🚜","🏎️"] },
  { label: "Home", emojis: ["🏠","🛋️","💡","🔧","🏗️","🧹","🛏️","🚿","📦","🔑","🏡","🌿","🧺","🪴","🛁","🔌"] },
  { label: "Health", emojis: ["💊","🏥","🩺","🧘","🏃","💪","🦷","👓","🩻","💉","🧬","❤️","🩹","🧴","🌡️","🏋️"] },
  { label: "Shopping", emojis: ["👕","👟","💄","🎒","💍","👜","🛍️","🧴","💻","📱","⌚","🎨","👒","🕶️","🪞","👗"] },
  { label: "Money", emojis: ["💰","💵","💳","📈","🏦","💸","🏆","🎁","💼","📊","🪙","🤑","💹","📉","🏧","💎"] },
  { label: "Fun", emojis: ["🎮","🎬","🎵","📚","🎲","🎭","🎸","🎾","⛷️","🏖️","🎡","🎪","🎯","🎻","⚽","🏄"] },
  { label: "Other", emojis: ["📝","📋","🔔","📞","🌐","🎓","✈️","🌙","⭐","🔥","✅","❓","🗂️","📌","🔐","🏷️"] },
];

const COLORS = [
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e",
  "#10b981","#06b6d4","#3b82f6","#6366f1","#8b5cf6","#d946ef",
  "#ec4899","#78716c","#64748b","#0f172a",
];

// ─── Emoji Picker ──────────────────────────────────────────────────────────────

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
          <>
            <span className="text-lg leading-none">{value}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="ml-auto text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]"
            >
              <XIcon size={11} />
            </button>
          </>
        ) : (
          <span className="text-[rgb(var(--muted))]">Pick emoji…</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-xl">
          <div className="max-h-56 overflow-y-auto p-2.5 space-y-2.5">
            {EMOJI_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
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

// ─── Color Picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:scale-110"
          style={{ background: color }}
        >
          {value === color && <CheckIcon size={11} weight="bold" className="text-white drop-shadow" />}
        </button>
      ))}
      <button
        type="button"
        onClick={() => colorInputRef.current?.click()}
        className="relative flex h-7 w-7 items-center justify-center rounded-lg border-2 border-dashed border-[rgb(var(--border))] transition hover:border-[rgb(var(--accent))]"
        title="Custom color"
        style={!COLORS.includes(value) && value ? { background: value, borderStyle: "solid", borderColor: "transparent" } : undefined}
      >
        {COLORS.includes(value) || !value ? (
          <span className="text-[10px] text-[rgb(var(--muted))]">+</span>
        ) : (
          <CheckIcon size={11} weight="bold" className="text-white drop-shadow" />
        )}
        <input
          ref={colorInputRef}
          type="color"
          value={value || "#6366f1"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </button>
    </div>
  );
}

// ─── Category Modal Form ──────────────────────────────────────────────────────

function CategoryModalForm({
  form,
  onChange,
  parentOptions,
  showTypeSelector,
  t,
}: {
  form: CategoryForm;
  onChange: (patch: Partial<CategoryForm>) => void;
  parentOptions: Category[];
  showTypeSelector: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-4">
      {showTypeSelector && (
        <div className="flex gap-2">
          {(["EXPENSE", "INCOME"] as const).map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => onChange({ type: tp, parentId: "" })}
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
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
          {t("categories.name")}
        </label>
        <input
          autoFocus
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Groceries"
          className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
            {t("categories.icon")}
          </label>
          <EmojiPicker value={form.icon} onChange={(v) => onChange({ icon: v })} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
            {t("categories.previewLabel")}
          </label>
          <div
            className="flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium text-white"
            style={{ background: form.color || "#6366f1" }}
          >
            {form.icon && <span className="text-base leading-none">{form.icon}</span>}
            <span className="truncate max-w-[80px]">{form.name || "Preview"}</span>
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
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ parentId: "" })}
              className={[
                "rounded-lg border px-3 py-1.5 text-xs transition",
                !form.parentId
                  ? "border-[rgb(var(--foreground))] bg-[rgb(var(--foreground))] text-[rgb(var(--background))]"
                  : "border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]",
              ].join(" ")}
            >
              {t("categories.noParent")}
            </button>
            {parentOptions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange({ parentId: p.id })}
                className={[
                  "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition",
                  form.parentId === p.id
                    ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent))]"
                    : "border-[rgb(var(--border))] text-[rgb(var(--foreground))] hover:bg-[rgb(var(--surface-soft))]",
                ].join(" ")}
              >
                {p.icon && <span>{p.icon}</span>}
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  subcategories,
  onEdit,
  onAddSub,
  onDeleteRequest,
  deleteConfirmId,
  onDeleteConfirm,
  onDeleteCancel,
  t,
}: {
  category: Category;
  subcategories: Category[];
  onEdit: (c: Category) => void;
  onAddSub: (parentId: string, type: "INCOME" | "EXPENSE") => void;
  onDeleteRequest: (id: string) => void;
  deleteConfirmId: string | null;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
  t: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = category.color ?? "#6366f1";
  const isConfirmingDelete = deleteConfirmId === category.id;

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] transition hover:border-[rgb(var(--border-soft))] hover:shadow-sm">
      {/* Color bar */}
      <div className="h-1 w-full" style={{ background: color }} />

      {/* Body */}
      <div className="p-3">
        {/* Icon */}
        <div
          className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-xl"
          style={{ background: color + "22" }}
        >
          {category.icon ? (
            <span className="leading-none">{category.icon}</span>
          ) : (
            <div className="h-4 w-4 rounded-full" style={{ background: color }} />
          )}
        </div>

        {/* Name */}
        <div className="mb-0.5 truncate text-sm font-semibold text-[rgb(var(--foreground))]">
          {category.name}
        </div>

        {/* Sub count / expand */}
        {subcategories.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mb-2 text-[11px] text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))] transition"
          >
            {expanded ? "▾" : "▸"} {subcategories.length} {t("categories.subcategories")}
          </button>
        ) : (
          <div className="mb-2 h-4" />
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-px border-t border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))]">
        {isConfirmingDelete ? (
          <div className="flex w-full items-center justify-between px-3 py-2">
            <span className="text-[11px] font-medium text-[rgb(var(--negative))]">
              {t("transactions.confirmDeleteQ")}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => onDeleteConfirm(category.id)}
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-[rgb(var(--negative))] text-white"
              >
                <CheckIcon size={10} weight="bold" />
              </button>
              <button
                onClick={onDeleteCancel}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))]"
              >
                <XIcon size={10} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => onEdit(category)}
              title={t("common.edit")}
              className="flex flex-1 items-center justify-center gap-1 py-2 text-[11px] text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface))] hover:text-[rgb(var(--foreground))]"
            >
              <PencilSimpleIcon size={11} weight="bold" />
              {t("common.edit")}
            </button>
            <div className="h-4 w-px bg-[rgb(var(--border-soft))]" />
            <button
              onClick={() => onAddSub(category.id, category.type === "INCOME" ? "INCOME" : "EXPENSE")}
              title={t("categories.addSub")}
              className="flex flex-1 items-center justify-center gap-1 py-2 text-[11px] text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface))] hover:text-[rgb(var(--foreground))]"
            >
              <PlusIcon size={11} weight="bold" />
              {t("categories.sub")}
            </button>
            {!category.isDefault && (
              <>
                <div className="h-4 w-px bg-[rgb(var(--border-soft))]" />
                <button
                  onClick={() => onDeleteRequest(category.id)}
                  title={t("common.delete")}
                  className="flex flex-1 items-center justify-center gap-1 py-2 text-[11px] text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
                >
                  <TrashIcon size={11} weight="bold" />
                  {t("common.delete")}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Subcategories */}
      {expanded && subcategories.length > 0 && (
        <div className="border-t border-[rgb(var(--border-soft))] p-2 space-y-1">
          {subcategories.map((sub) => (
            <SubCategoryRow
              key={sub.id}
              category={sub}
              onEdit={onEdit}
              deleteConfirmId={deleteConfirmId}
              onDeleteConfirm={onDeleteConfirm}
              onDeleteCancel={onDeleteCancel}
              onDeleteRequest={onDeleteRequest}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Subcategory row ──────────────────────────────────────────────────────────

function SubCategoryRow({
  category,
  onEdit,
  deleteConfirmId,
  onDeleteConfirm,
  onDeleteCancel,
  onDeleteRequest,
  t,
}: {
  category: Category;
  onEdit: (c: Category) => void;
  deleteConfirmId: string | null;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
  onDeleteRequest: (id: string) => void;
  t: (key: string) => string;
}) {
  const bg = category.color ?? "#6366f1";
  const isConfirming = deleteConfirmId === category.id;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface))] px-2.5 py-2">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-sm"
        style={{ background: bg + "22" }}
      >
        {category.icon ? (
          <span className="text-xs leading-none">{category.icon}</span>
        ) : (
          <div className="h-2 w-2 rounded-full" style={{ background: bg }} />
        )}
      </div>
      <span className="flex-1 truncate text-xs font-medium text-[rgb(var(--foreground))]">{category.name}</span>

      {isConfirming ? (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDeleteConfirm(category.id)}
            className="flex h-5 w-5 items-center justify-center rounded-md bg-[rgb(var(--negative))] text-white"
          >
            <CheckIcon size={9} weight="bold" />
          </button>
          <button
            onClick={onDeleteCancel}
            className="flex h-5 w-5 items-center justify-center rounded-md border border-[rgb(var(--border))] text-[rgb(var(--muted))]"
          >
            <XIcon size={9} />
          </button>
        </div>
      ) : (
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(category)}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
          >
            <PencilSimpleIcon size={10} weight="bold" />
          </button>
          {!category.isDefault && (
            <button
              onClick={() => onDeleteRequest(category.id)}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
            >
              <TrashIcon size={10} weight="bold" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CategoriesPageClient() {
  const { t } = useI18n();
  const { workspace } = useLuca();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeType, setActiveType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [search, setSearch] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [modalForm, setModalForm] = useState<CategoryForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function loadCategories() {
    if (!workspace) return;
    setLoading(true);
    setLoadError(false);
    apiFetch<{ categories: Category[] }>(`/api/categories?workspaceId=${workspace.id}`)
      .then((r) => setCategories(r.categories))
      .catch((err) => { console.error(err); setLoadError(true); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadCategories(); }, [workspace]);

  function openCreate(parentId?: string, type?: "INCOME" | "EXPENSE") {
    setEditingCategory(null);
    setModalForm({ ...defaultForm, type: type ?? activeType, parentId: parentId ?? "" });
    setShowModal(true);
  }

  function openEdit(category: Category) {
    setEditingCategory(category);
    setModalForm({
      name: category.name,
      type: category.type === "TRANSFER" ? "EXPENSE" : category.type,
      icon: category.icon ?? "",
      color: category.color ?? "#6366f1",
      parentId: category.parentId ?? "",
    });
    setShowModal(true);
  }

  async function saveModal() {
    if (!workspace || !modalForm.name) return;
    setSaving(true);
    try {
      if (editingCategory) {
        await apiFetch(`/api/categories/${editingCategory.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: modalForm.name,
            icon: modalForm.icon || null,
            color: modalForm.color || null,
            parentId: modalForm.parentId || null,
          }),
        });
      } else {
        await apiFetch("/api/categories", {
          method: "POST",
          body: JSON.stringify({
            workspaceId: workspace.id,
            name: modalForm.name,
            type: modalForm.type,
            icon: modalForm.icon || null,
            color: modalForm.color || null,
            parentId: modalForm.parentId || null,
          }),
        });
      }
      setShowModal(false);
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

  const allOfType = categories.filter((c) => c.type === activeType);
  const searchLower = search.toLowerCase();
  const matchesSearch = (c: Category) =>
    !search || c.name.toLowerCase().includes(searchLower);

  const roots = allOfType.filter((c) => !c.parentId && matchesSearch(c));
  const getChildren = (id: string) => allOfType.filter((c) => c.parentId === id);

  const parentOptions = categories.filter((c) => c.type === modalForm.type && !c.parentId);

  const expenseCount = categories.filter((c) => c.type === "EXPENSE").length;
  const incomeCount = categories.filter((c) => c.type === "INCOME").length;

  return (
    <div className="max-w-3xl space-y-5">
      {loadError && (
        <div className="rounded-xl border border-[rgb(var(--negative-dim))] bg-[rgb(var(--negative-dim))] px-4 py-3 text-sm text-[rgb(var(--negative))]">
          {t("common.errorLoading")}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("categories.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("categories.subtitle")}</p>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-1.5 rounded-xl bg-[rgb(var(--foreground))] px-4 py-2 text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 active:scale-[0.97]"
        >
          <PlusIcon size={14} weight="bold" />
          {t("categories.add")}
        </button>
      </div>

      {/* Type tabs + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1.5 rounded-xl bg-[rgb(var(--surface-soft))] p-1">
          {(["EXPENSE", "INCOME"] as const).map((type) => {
            const count = type === "EXPENSE" ? expenseCount : incomeCount;
            return (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={[
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition",
                  activeType === type
                    ? type === "EXPENSE"
                      ? "bg-[rgb(var(--negative))] text-white shadow-sm"
                      : "bg-[rgb(var(--positive))] text-white shadow-sm"
                    : "text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]",
                ].join(" ")}
              >
                {type === "EXPENSE" ? t("categories.expense") : t("categories.income")}
                <span className={[
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  activeType === type ? "bg-white/20 text-white" : "bg-[rgb(var(--surface))] text-[rgb(var(--muted))]",
                ].join(" ")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative sm:flex-1">
          <MagnifyingGlassIcon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("categories.search")}
            className="h-10 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] pl-9 pr-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]"
            >
              <XIcon size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Category grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]" />
          ))}
        </div>
      ) : roots.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-16 text-center">
          <span className="mb-3 text-4xl opacity-20">🏷️</span>
          <p className="text-sm text-[rgb(var(--muted))]">
            {search ? t("categories.noResults") : t("categories.empty")}
          </p>
          {!search && (
            <button
              onClick={() => openCreate()}
              className="mt-4 flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] px-3 py-2 text-sm text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
            >
              <PlusIcon size={13} weight="bold" />
              {t("categories.add")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {roots.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              subcategories={getChildren(cat.id)}
              onEdit={openEdit}
              onAddSub={(parentId, type) => openCreate(parentId, type)}
              onDeleteRequest={(id) => setDeleteConfirmId((p) => (p === id ? null : id))}
              deleteConfirmId={deleteConfirmId}
              onDeleteConfirm={(id) => deleteCategory(id)}
              onDeleteCancel={() => setDeleteConfirmId(null)}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingCategory ? t("categories.editTitle") : t("categories.newTitle")}
        maxWidth="sm"
        footer={
          <button
            onClick={saveModal}
            disabled={saving || !modalForm.name}
            className="h-10 w-full rounded-xl bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40"
          >
            {saving ? t("common.loading") : t("common.save")}
          </button>
        }
      >
        <CategoryModalForm
          form={modalForm}
          onChange={(patch) => setModalForm((f) => ({ ...f, ...patch }))}
          parentOptions={parentOptions}
          showTypeSelector={!editingCategory}
          t={t}
        />
      </Modal>
    </div>
  );
}
