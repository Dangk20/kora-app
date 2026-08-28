"use client";

// Alta y edición de cupón (CUP_HU002 / CUP_HU003), en tarjetas.

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createCoupon, updateCoupon, type CouponActionResult } from "@/modules/coupons/actions";

const input =
  "w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3.5 py-2.5 text-sm outline-none focus:border-kora-coral";
const inputErr = "w-full rounded-[10px] border-[1.6px] border-destructive px-3.5 py-2.5 text-sm outline-none";
const label = "mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]";
const card = "space-y-3 rounded-[12px] border border-[#eee9e2] p-4";
const cardTitle = "text-[13px] font-bold text-kora-black";

type Coupon = {
  id: string;
  code: string;
  name: string;
  description: string;
  type: "PERCENT" | "FIXED" | "FREE_PRODUCT";
  percentValue: string;
  amountCop: string;
  amountUsd: string;
  freeVariantId: string;
  validFrom: string;
  validTo: string;
  maxUses: string;
  minSubtotalCop: string;
  minSubtotalUsd: string;
  perCustomerLimit: string;
  active: boolean;
  firstPurchaseOnly: boolean;
  appliesToSaleItems: boolean;
  scope: "ALL" | "CATEGORIES" | "PRODUCTS";
  categoryIds: string[];
  productIds: string[];
  usedCount: number;
};

function Toggle({
  name,
  label: texto,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="mt-0.5 size-4" />
      <span>
        <span className="block text-[13px] font-semibold text-kora-black">{texto}</span>
        <span className="block text-[11.5px] text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

export function CouponForm({
  coupon,
  categorias,
  productos,
  backTo,
}: {
  coupon: Coupon | null;
  categorias: { id: string; name: string }[];
  productos: { id: string; name: string; variants: { id: string; name: string }[] }[];
  backTo: string;
}) {
  const router = useRouter();
  const editando = coupon !== null;
  const [tipo, setTipo] = useState(coupon?.type ?? "PERCENT");
  const [alcance, setAlcance] = useState(coupon?.scope ?? "ALL");

  const [state, formAction, pending] = useActionState<CouponActionResult | null, FormData>(
    async (_p, fd) => (editando ? updateCoupon(fd) : createCoupon(fd)),
    null,
  );

  const close = () => router.push(backTo);
  const err = state && !state.ok ? state.field : undefined;

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      router.push(backTo);
    }
  }, [state, router, backTo]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(14,15,18,0.5)]" onClick={close}>
      <div
        className="flex h-full w-[520px] max-w-full flex-col overflow-y-auto bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#f0ece6] bg-white px-6 py-5">
          <h2 className="text-lg font-bold text-kora-black">
            {editando ? "Editar cupón" : "Crear cupón"}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="flex size-[34px] items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <form action={formAction} className="flex-1 space-y-4 px-6 py-5">
          {editando && <input type="hidden" name="id" value={coupon.id} />}

          {state && !state.ok && (
            <p className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
              {state.error}
            </p>
          )}

          {editando && coupon.usedCount > 0 && (
            <p className="rounded-[10px] border border-[#ffd9c7] bg-[#FFF4EF] px-3.5 py-2.5 text-[12.5px] text-[#8a5a2b]">
              Este cupón ya tiene <strong>{coupon.usedCount}</strong> usos. Los cambios solo
              afectan canjes futuros; los pedidos existentes conservan su descuento original.
            </p>
          )}

          <div className={card}>
            <h3 className={cardTitle}>Identidad</h3>
            <div>
              <label className={label} htmlFor="code">Código del cupón</label>
              <input
                id="code"
                name="code"
                defaultValue={coupon?.code}
                readOnly={editando}
                required={!editando}
                placeholder="VERANO20"
                style={{ textTransform: "uppercase" }}
                className={`${err === "code" ? inputErr : input} ${editando ? "bg-[#f5f3f0] font-mono" : "font-mono"}`}
              />
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                No se puede cambiar después de crear el cupón.
              </p>
            </div>
            <div>
              <label className={label} htmlFor="name">Nombre interno</label>
              <input id="name" name="name" defaultValue={coupon?.name} required className={err === "name" ? inputErr : input} />
              <p className="mt-1 text-[11.5px] text-muted-foreground">Solo lo ven en el admin.</p>
            </div>
            <div>
              <label className={label} htmlFor="description">Descripción (opcional)</label>
              <input id="description" name="description" defaultValue={coupon?.description} className={input} />
            </div>
          </div>

          <div className={card}>
            <h3 className={cardTitle}>Descuento</h3>
            <div className="flex flex-wrap gap-3">
              {([
                ["PERCENT", "% Porcentaje"],
                ["FIXED", "$ Monto fijo"],
                ["FREE_PRODUCT", "🎁 Producto gratis"],
              ] as const).map(([v, l]) => (
                <label key={v} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
                  <input
                    type="radio"
                    name="type"
                    value={v}
                    checked={tipo === v}
                    onChange={() => setTipo(v)}
                  />
                  {l}
                </label>
              ))}
            </div>

            {tipo === "PERCENT" && (
              <div>
                <label className={label} htmlFor="percentValue">Porcentaje (1–100)</label>
                <input
                  id="percentValue"
                  name="percentValue"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={coupon?.percentValue}
                  className={err === "percentValue" ? inputErr : input}
                />
              </div>
            )}

            {tipo === "FIXED" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="amountCop">Descuento en COP</label>
                  <input id="amountCop" name="amountCop" type="number" min={0} defaultValue={coupon?.amountCop} className={err === "amountCop" ? inputErr : input} />
                </div>
                <div>
                  <label className={label} htmlFor="amountUsd">Descuento en USD</label>
                  <input id="amountUsd" name="amountUsd" type="number" min={0} step="0.01" defaultValue={coupon?.amountUsd} className={input} />
                </div>
                <p className="col-span-2 text-[11.5px] text-muted-foreground">
                  Llena una o las dos. No se convierte entre monedas: si el cupón solo tiene
                  una y el pedido está en la otra, se rechaza.
                </p>
              </div>
            )}

            {tipo === "FREE_PRODUCT" && (
              <div>
                <label className={label} htmlFor="freeVariantId">Producto que se regala</label>
                <select id="freeVariantId" name="freeVariantId" defaultValue={coupon?.freeVariantId} className={err === "freeVariantId" ? inputErr : input}>
                  <option value="">Elige un producto…</option>
                  {productos.flatMap((p) =>
                    p.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {p.name}{v.name !== "Única" ? ` · ${v.name}` : ""}
                      </option>
                    )),
                  )}
                </select>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  Entra al pedido con precio $0. Su stock se descuenta al confirmar, como
                  cualquier otro producto.
                </p>
              </div>
            )}
          </div>

          <div className={card}>
            <h3 className={cardTitle}>Restricciones</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="validFrom">Válido desde</label>
                <input id="validFrom" name="validFrom" type="date" defaultValue={coupon?.validFrom} className={input} />
              </div>
              <div>
                <label className={label} htmlFor="validTo">Vence el</label>
                <input id="validTo" name="validTo" type="date" defaultValue={coupon?.validTo} className={err === "validTo" ? inputErr : input} />
              </div>
              <div>
                <label className={label} htmlFor="maxUses">Máximo de usos</label>
                <input id="maxUses" name="maxUses" type="number" min={1} placeholder="∞" defaultValue={coupon?.maxUses} className={err === "maxUses" ? inputErr : input} />
              </div>
              <div>
                <label className={label} htmlFor="perCustomerLimit">Máximo por cliente</label>
                <input id="perCustomerLimit" name="perCustomerLimit" type="number" min={1} defaultValue={coupon?.perCustomerLimit ?? "1"} className={input} />
              </div>
              {/* Compra mínima: DOS campos, uno por moneda. No hay conversión
                  en KORA, así que un solo importe obligaría a inventar una
                  tasa de cambio. Dejar uno vacío = ese cupón no impone mínimo
                  a las compras en esa moneda. */}
              <div>
                <label className={label} htmlFor="minSubtotalCop">Compra mínima en COP</label>
                <input id="minSubtotalCop" name="minSubtotalCop" type="number" min={0} placeholder="Sin mínimo" defaultValue={coupon?.minSubtotalCop} className={input} />
              </div>
              <div>
                <label className={label} htmlFor="minSubtotalUsd">Compra mínima en USD</label>
                <input id="minSubtotalUsd" name="minSubtotalUsd" type="number" min={0} step="0.01" placeholder="Sin mínimo" defaultValue={coupon?.minSubtotalUsd} className={input} />
              </div>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              Vacío = sin límite. Usos actuales: {coupon?.usedCount ?? 0}.
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              La compra mínima se mide sobre el <strong>subtotal</strong>, antes de
              aplicar el descuento. Cada moneda lleva el suyo: no se convierten.
            </p>
          </div>

          <div className={`${card} space-y-2.5`}>
            <h3 className={cardTitle}>Comportamiento</h3>
            <Toggle name="active" label="Activo" hint="Si está apagado, nadie puede usarlo aunque lo escriba." defaultChecked={coupon?.active ?? true} />
            <Toggle name="firstPurchaseOnly" label="Solo primera compra" hint="Válido solo para clientes sin pedidos confirmados previos." defaultChecked={coupon?.firstPurchaseOnly ?? false} />
            <Toggle name="appliesToSaleItems" label="Aplica a productos en oferta" hint="Apagado: los productos ya rebajados quedan fuera del descuento." defaultChecked={coupon?.appliesToSaleItems ?? true} />
          </div>

          <div className={card}>
            <h3 className={cardTitle}>Alcance</h3>
            <div className="flex flex-wrap gap-3">
              {([
                ["ALL", "Todo el catálogo"],
                ["CATEGORIES", "Categorías"],
                ["PRODUCTS", "Productos"],
              ] as const).map(([v, l]) => (
                <label key={v} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
                  <input type="radio" name="scope" value={v} checked={alcance === v} onChange={() => setAlcance(v)} />
                  {l}
                </label>
              ))}
            </div>

            {alcance === "CATEGORIES" && (
              <select
                name="categoryIds"
                multiple
                defaultValue={coupon?.categoryIds}
                size={Math.min(6, Math.max(3, categorias.length))}
                className={err === "categoryIds" ? inputErr : input}
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            {alcance === "PRODUCTS" && (
              <select
                name="productIds"
                multiple
                defaultValue={coupon?.productIds}
                size={Math.min(8, Math.max(3, productos.length))}
                className={err === "productIds" ? inputErr : input}
              >
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2.5 pt-1 pb-4">
            <button type="button" onClick={close} className="flex-1 rounded-[10px] border-[1.6px] border-[#e2ddd6] py-3 text-sm font-semibold text-kora-black">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="bg-kora-gradient flex-1 rounded-[10px] py-3 text-sm font-semibold text-white disabled:opacity-60">
              {pending ? "Guardando…" : editando ? "Guardar cambios" : "Crear cupón"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
