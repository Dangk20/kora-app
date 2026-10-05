"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type ActionResult,
} from "@/modules/catalog/category-actions";
import { CATEGORY_ICONS, TILE_PALETTE, inkFor } from "@/modules/catalog/tiles";

type Child = { id: string; name: string; nameEn: string | null; icon: string; productCount: number };
type Parent = {
  id: string;
  name: string;
  nameEn: string | null;
  color: string;
  icon: string;
  /** Incluye los de sus subcategorías. */
  productCount: number;
  children: Child[];
};

/** Lo que se edita: una categoría padre (con color) o una subcategoría. */
type Editable = { id: string; name: string; nameEn: string | null; icon: string; color?: string };

const ICON_OPTIONS = Object.keys(CATEGORY_ICONS);

function ErrorText({ state }: { state: ActionResult }) {
  if (!state || state.ok) return null;
  return <p className="mt-2 text-xs font-semibold text-destructive">{state.error}</p>;
}

// ── Creador con preview en vivo (patrón del prototipo) ──────
function CategoryCreator() {
  const [state, formAction, pending] = useActionState(createCategory, null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TILE_PALETTE[0].bg);
  const [icon, setIcon] = useState("package");
  const PreviewIcon = CATEGORY_ICONS[icon];

  useEffect(() => {
    if (state?.ok) setName("");
  }, [state]);

  return (
    <div className="mb-5 rounded-[18px] bg-white p-6 shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
      <h3 className="mb-4 text-base font-bold text-kora-black">Crear nueva categoría</h3>
      <form action={formAction} className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <input type="hidden" name="color" value={color} />
        <input type="hidden" name="icon" value={icon} />
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold text-[#6b6f78]" htmlFor="new-cat-name">
            Nombre de la categoría
          </label>
          <input
            id="new-cat-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Mascotas, Juguetería, Libros…"
            required
            className="w-full max-w-90 rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3.5 py-3 text-sm outline-none focus:border-kora-coral"
          />
          <div className="mt-4">
            <span className="mb-2 block text-xs font-semibold text-[#6b6f78]">Color</span>
            <div className="flex flex-wrap gap-2.5">
              {TILE_PALETTE.map((p) => (
                <button
                  key={p.bg}
                  type="button"
                  onClick={() => setColor(p.bg)}
                  aria-label={`Color ${p.bg}`}
                  className="size-[34px] rounded-full"
                  style={{
                    background: p.bg,
                    boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${color === p.bg ? p.ink : "transparent"}`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="mt-4">
            <span className="mb-2 block text-xs font-semibold text-[#6b6f78]">Ícono</span>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((key) => {
                const Icon = CATEGORY_ICONS[key];
                const selected = icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcon(key)}
                    aria-label={`Ícono ${key}`}
                    className="flex size-10 items-center justify-center rounded-[11px]"
                    style={{
                      background: selected ? color : "#f5f3f0",
                      color: selected ? inkFor(color) : "#8a8f98",
                    }}
                  >
                    <Icon className="size-5" strokeWidth={1.8} />
                  </button>
                );
              })}
            </div>
          </div>
          <ErrorText state={state} />
        </div>
        <div className="w-full shrink-0 sm:w-[200px]">
          <div
            className="flex min-h-[130px] flex-col justify-between rounded-2xl p-5"
            style={{ background: color }}
          >
            <span className="flex size-[46px] items-center justify-center rounded-xl bg-white/65 text-kora-black">
              <PreviewIcon className="size-[26px]" strokeWidth={1.8} />
            </span>
            <span className="text-[17px] font-bold text-kora-black">
              {name || "Nueva categoría"}
            </span>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="bg-kora-gradient mt-3 w-full rounded-[11px] py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,90,31,0.3)] hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Creando…" : "Crear categoría"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Card de categoría con subcategorías (chips) ─────────────
function SubcategoryChip({
  sub,
  canEdit,
  canDelete,
  onEdit,
}: {
  sub: Child;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
}) {
  const [state, formAction, pending] = useActionState(deleteCategory, null);
  const SubIcon = CATEGORY_ICONS[sub.icon] ?? CATEGORY_ICONS.package;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f3f0] py-1.5 pr-2 pl-2.5 text-[12.5px] font-semibold text-kora-black">
      <SubIcon className="size-3.5 text-[#6b6f78]" strokeWidth={1.8} />
      {sub.name}{" "}
      <span className="font-medium text-[#b3b8c0]">({sub.productCount})</span>
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${sub.name}`}
          title="Editar nombre e ícono"
          className="flex size-[18px] items-center justify-center rounded-full bg-[#e7e2da] text-[#8a8f98] hover:bg-[#FFE9DD] hover:text-kora-coral"
        >
          <Pencil className="size-[10px]" />
        </button>
      )}
      {canDelete && (
        <form action={formAction} className="flex">
          <input type="hidden" name="id" value={sub.id} />
          <button
            type="submit"
            disabled={pending || sub.productCount > 0}
            title={
              sub.productCount > 0
                ? "Tiene productos: reasígnalos primero"
                : "Eliminar subcategoría"
            }
            aria-label={`Eliminar ${sub.name}`}
            className="flex size-[18px] items-center justify-center rounded-full bg-[#e7e2da] text-[#8a8f98] hover:bg-[#fce8e8] hover:text-destructive disabled:opacity-40"
          >
            <X className="size-[11px]" />
          </button>
        </form>
      )}
      {state && !state.ok && (
        <span className="text-[10px] text-destructive">{state.error}</span>
      )}
    </span>
  );
}

function AddSubcategory({ parentId }: { parentId: string }) {
  const [state, formAction, pending] = useActionState(createCategory, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex gap-2">
      <input type="hidden" name="parentId" value={parentId} />
      <input
        name="name"
        placeholder="Nueva subcategoría…"
        required
        className="flex-1 rounded-[9px] border-[1.6px] border-[#e2ddd6] px-3 py-2 text-[13px] outline-none focus:border-kora-coral"
      />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1.5 rounded-[9px] bg-[#FFE9DD] px-3.5 py-2 text-[12.5px] font-bold text-kora-coral hover:opacity-80 disabled:opacity-60"
      >
        <Plus className="size-3.5" /> Agregar
      </button>
      <ErrorText state={state} />
    </form>
  );
}

/**
 * Editar nombre e ícono (y color, en la categoría padre). Reemplaza el
 * renombrado escribiendo sobre el título, que nadie descubría (4 oct 2026).
 */
function CategoryEditModal({ category, onClose }: { category: Editable; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(updateCategory, null);
  const [name, setName] = useState(category.name);
  const [nameEn, setNameEn] = useState(category.nameEn ?? "");
  const [icon, setIcon] = useState(category.icon);
  const [color, setColor] = useState(category.color);
  const esPadre = category.color !== undefined;

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(14,15,18,0.55)] p-6"
      onClick={onClose}
      role="presentation"
    >
      <form
        action={formAction}
        className="w-[480px] max-w-full rounded-[18px] bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Editar ${category.name}`}
      >
        <input type="hidden" name="id" value={category.id} />
        <input type="hidden" name="icon" value={icon} />
        {esPadre && <input type="hidden" name="color" value={color} />}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-kora-black">
            {esPadre ? "Editar categoría" : "Editar subcategoría"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-4" />
          </button>
        </div>

        <label className="mb-1.5 block text-xs font-semibold text-[#6b6f78]" htmlFor="edit-cat-name">
          Nombre
        </label>
        <input
          id="edit-cat-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          className="w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3.5 py-3 text-sm outline-none focus:border-kora-coral"
        />

        <label className="mt-4 mb-1.5 block text-xs font-semibold text-[#6b6f78]" htmlFor="edit-cat-name-en">
          Nombre en inglés <span className="font-normal text-[#9aa0ab]">(tienda para el exterior)</span>
        </label>
        <input
          id="edit-cat-name-en"
          name="nameEn"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder="Vacío = se muestra el nombre en español"
          className="w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3.5 py-3 text-sm outline-none focus:border-kora-coral"
        />

        {esPadre && (
          <div className="mt-4">
            <span className="mb-2 block text-xs font-semibold text-[#6b6f78]">Color</span>
            <div className="flex flex-wrap gap-2.5">
              {TILE_PALETTE.map((p) => (
                <button
                  key={p.bg}
                  type="button"
                  onClick={() => setColor(p.bg)}
                  aria-label={`Color ${p.bg}`}
                  className="size-[30px] rounded-full"
                  style={{
                    background: p.bg,
                    boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${color === p.bg ? p.ink : "transparent"}`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <span className="mb-2 block text-xs font-semibold text-[#6b6f78]">Ícono</span>
          <div className="flex flex-wrap gap-2">
            {ICON_OPTIONS.map((key) => {
              const Icon = CATEGORY_ICONS[key];
              const selected = icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  aria-label={`Ícono ${key}`}
                  aria-pressed={selected}
                  className="flex size-10 items-center justify-center rounded-[11px]"
                  style={{
                    background: selected ? (color ?? "#FFE9DD") : "#f5f3f0",
                    color: selected ? inkFor(color ?? "#FFE9DD") : "#8a8f98",
                  }}
                >
                  <Icon className="size-5" strokeWidth={1.8} />
                </button>
              );
            })}
          </div>
        </div>

        <ErrorText state={state} />
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[11px] px-4 py-2.5 text-[13px] font-semibold text-[#6b6f78] hover:text-kora-black"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending || name.trim().length < 2}
            className="bg-kora-gradient rounded-[11px] px-5 py-2.5 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteCategoryButton({ category }: { category: Parent }) {
  const [state, formAction, pending] = useActionState(deleteCategory, null);
  const blocked = category.productCount > 0 || category.children.length > 0;
  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="id" value={category.id} />
      <button
        type="submit"
        disabled={pending || blocked}
        title={
          blocked
            ? "Tiene productos o subcategorías: vacíala primero"
            : "Eliminar categoría"
        }
        aria-label={`Eliminar ${category.name}`}
        className="flex size-[34px] items-center justify-center rounded-[9px] bg-white/55 text-[#8a8f98] hover:text-destructive disabled:opacity-40"
      >
        <Trash2 className="size-[17px]" />
      </button>
      {state && !state.ok && (
        <span className="text-[10px] text-destructive">{state.error}</span>
      )}
    </form>
  );
}

export function CategoryManager({
  parents,
  canCreate,
  canEdit,
  canDelete,
}: {
  parents: Parent[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<Editable | null>(null);
  return (
    <div>
      {canCreate && <CategoryCreator />}
      {editing && <CategoryEditModal category={editing} onClose={() => setEditing(null)} />}
      <div className="grid gap-4 xl:grid-cols-2">
        {parents.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.icon] ?? CATEGORY_ICONS.package;
          return (
            <div
              key={cat.id}
              className="overflow-hidden rounded-2xl bg-white shadow-[0_3px_14px_rgba(0,0,0,0.04)]"
            >
              <div
                className="flex items-center gap-3 px-4.5 py-4"
                style={{ background: cat.color }}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/65 text-kora-black">
                  <Icon className="size-6" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] font-bold text-kora-black">
                    {cat.name}
                  </div>
                  <div className="text-xs text-[#6b5a4a]">
                    {cat.productCount} producto{cat.productCount === 1 ? "" : "s"}
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({ id: cat.id, name: cat.name, nameEn: cat.nameEn, icon: cat.icon, color: cat.color })
                    }
                    aria-label={`Editar ${cat.name}`}
                    title="Editar nombre, color e ícono"
                    className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-white/55 text-[#6b6f78] hover:text-kora-coral"
                  >
                    <Pencil className="size-[16px]" />
                  </button>
                )}
                {canDelete && <DeleteCategoryButton category={cat} />}
              </div>
              <div className="px-4.5 py-4">
                <div className="mb-2.5 text-[11.5px] font-bold tracking-wide text-[#9aa0ab] uppercase">
                  Subcategorías
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {cat.children.length === 0 && (
                    <span className="text-[12.5px] text-[#b3b8c0]">
                      Aún no hay subcategorías. Agrega una abajo.
                    </span>
                  )}
                  {cat.children.map((sub) => (
                    <SubcategoryChip
                      key={sub.id}
                      sub={sub}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onEdit={() => setEditing({ id: sub.id, name: sub.name, nameEn: sub.nameEn, icon: sub.icon })}
                    />
                  ))}
                </div>
                {canCreate && <AddSubcategory parentId={cat.id} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
