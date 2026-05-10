"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon
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
  type: "INCOME" | "EXPENSE";
  icon: string;
  color: string;
  parentId: string;
};

const defaultForm: CategoryForm = {
  name: "",
  type: "EXPENSE",
  icon: "",
  color: "",
  parentId: ""
};

export function CategoriesPageClient() {
  const { t } = useI18n();
  const { workspace } = useLuca();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CategoryForm>(defaultForm);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(defaultForm);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function loadCategories() {
    if (!workspace) return;
    setLoading(true);
    apiFetch<{ categories: Category[] }>(`/api/categories?workspaceId=${workspace.id}`)
      .then((r) => setCategories(r.categories))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCategories();
  }, [workspace]);

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
          parentId: form.parentId || null
        })
      });
      setForm(defaultForm);
      setShowForm(false);
      loadCategories();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      type: category.type === "TRANSFER" ? "EXPENSE" : category.type,
      icon: category.icon ?? "",
      color: category.color ?? "",
      parentId: category.parentId ?? ""
    });
    setDeleteConfirmId(null);
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
          parentId: editForm.parentId || null
        })
      });
      setEditingId(null);
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
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const incomeCategories = categories.filter((c) => c.type === "INCOME");
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  const parentOptions = (type: "INCOME" | "EXPENSE") =>
    categories.filter((c) => c.type === type && !c.parentId);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("categories.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">{t("categories.subtitle")}</p>
        </div>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setEditingId(null);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.97]"
        >
          {showForm ? <XIcon size={14} weight="bold" /> : <PlusIcon size={14} weight="bold" />}
          {t("categories.add")}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border-soft))] px-5 py-4">
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
                      : "border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]"
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
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
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
        <div className="space-y-6">
          <CategorySection
            title={t("categories.expense")}
            categories={expenseCategories}
            editingId={editingId}
            editForm={editForm}
            onEditFormChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
            deleteConfirmId={deleteConfirmId}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditingId(null)}
            onDeleteRequest={(id) => {
              setDeleteConfirmId((prev) => (prev === id ? null : id));
              setEditingId(null);
            }}
            onDeleteConfirm={deleteCategory}
            onDeleteCancel={() => setDeleteConfirmId(null)}
            parentOptions={parentOptions("EXPENSE")}
            saving={saving}
            t={t}
          />
          <CategorySection
            title={t("categories.income")}
            categories={incomeCategories}
            editingId={editingId}
            editForm={editForm}
            onEditFormChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
            deleteConfirmId={deleteConfirmId}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditingId(null)}
            onDeleteRequest={(id) => {
              setDeleteConfirmId((prev) => (prev === id ? null : id));
              setEditingId(null);
            }}
            onDeleteConfirm={deleteCategory}
            onDeleteCancel={() => setDeleteConfirmId(null)}
            parentOptions={parentOptions("INCOME")}
            saving={saving}
            t={t}
          />
        </div>
      )}
    </div>
  );
}

function CategorySection({
  title,
  categories,
  editingId,
  editForm,
  onEditFormChange,
  deleteConfirmId,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  parentOptions,
  saving,
  t
}: {
  title: string;
  categories: Category[];
  editingId: string | null;
  editForm: CategoryForm;
  onEditFormChange: (patch: Partial<CategoryForm>) => void;
  deleteConfirmId: string | null;
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
  if (categories.length === 0) return null;

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted))]">
        {title}
      </div>
      <div className="overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        {categories.map((category, idx) => (
          <div key={category.id}>
            {editingId === category.id ? (
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{t("common.edit")}</span>
                  <button
                    onClick={onCancelEdit}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))]"
                  >
                    <XIcon size={13} />
                  </button>
                </div>
                <CategoryFormFields
                  form={editForm}
                  onChange={onEditFormChange}
                  parentOptions={parentOptions}
                  t={t}
                />
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
            ) : (
              <div
                className={[
                  "group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[rgb(var(--surface-soft))]",
                  idx < categories.length - 1 ? "border-b border-[rgb(var(--border-soft))]" : ""
                ].join(" ")}
              >
                {category.icon ? (
                  <span className="text-lg leading-none">{category.icon}</span>
                ) : (
                  <div
                    className="h-6 w-6 shrink-0 rounded-full"
                    style={{
                      background: category.color ?? "rgb(var(--surface-soft))"
                    }}
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[rgb(var(--foreground))]">
                      {category.name}
                    </span>
                    {category.isDefault && (
                      <span className="rounded-md bg-[rgb(var(--accent-dim))] px-1.5 py-0.5 text-[10px] font-medium text-[rgb(var(--accent))]">
                        {t("categories.defaultBadge")}
                      </span>
                    )}
                    {category.parentId && (
                      <span className="text-xs text-[rgb(var(--muted-soft))]">↳</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {deleteConfirmId === category.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[rgb(var(--muted))]">
                      {t("categories.deleteConfirm")}
                    </span>
                    <button
                      onClick={() => onDeleteConfirm(category.id)}
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
                  </div>
                ) : (
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => onStartEdit(category)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))]"
                      title={t("common.edit")}
                    >
                      <PencilIcon size={13} weight="bold" />
                    </button>
                    <button
                      onClick={() => onDeleteRequest(category.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--negative-dim))] hover:text-[rgb(var(--negative))]"
                      title={t("common.delete")}
                    >
                      <TrashIcon size={13} weight="bold" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryFormFields({
  form,
  onChange,
  parentOptions,
  t
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
            {t("categories.icon")}
          </label>
          <input
            value={form.icon}
            onChange={(e) => onChange({ icon: e.target.value })}
            placeholder="🛒"
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">
            {t("categories.color")}
          </label>
          <input
            value={form.color}
            onChange={(e) => onChange({ color: e.target.value })}
            placeholder="#6366f1"
            className="h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
          />
        </div>
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
