"use client";

// Checkout de un solo paso (PED_HU001): datos del comprador + resumen.
// Al enviar se crea el pedido y se pasa a la pantalla puente que abre WhatsApp.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Loader2, ShieldCheck } from "lucide-react";
import { useCart } from "@/modules/cart/cart-context";
import { applyCoupon } from "@/modules/coupons/apply-action";
import { getResolvedCart } from "@/modules/cart/actions";
import type { ResolvedCart } from "@/modules/cart/resolve";
import { createOrder } from "@/modules/orders/checkout-actions";
import { formatMoney } from "@/modules/pricing";
import {
  CIUDADES_SUGERIDAS,
  DEPARTAMENTOS_CO,
  DOCUMENT_TYPES,
  PAYMENT_METHODS,
  US_STATES,
} from "@/modules/orders/geo";
import { CategoryTile } from "@/modules/catalog/tiles";
import { OrderBridge } from "./order-bridge";

// `min-h-12` = 48 px: el mínimo táctil del diseño (§05). Y `text-base` en
// móvil no es estética — iOS hace zoom automático sobre cualquier campo con
// fuente menor de 16 px, y al salir del campo la página se queda ampliada.
const inputCls =
  "w-full min-h-12 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-[15px] py-3 text-base sm:text-sm outline-none focus:border-kora-coral";
const labelCls = "mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]";

type Country = "CO" | "US";

/** Datos del comprador con sesión, para no hacerle escribir lo que ya sabemos. */
export type BuyerDefaults = {
  name: string;
  email: string;
  phone: string;
  /** Saldo de Kora Cashback en la moneda activa. Solo informativo: el importe
   *  aplicable lo decide el servidor al crear el pedido. */
  cashback: number;
} | null;

export function CheckoutView({
  initialCountry,
  buyer,
}: {
  initialCountry: Country;
  buyer?: BuyerDefaults;
}) {
  const { lines, ready, clear } = useCart();
  const [cart, setCart] = useState<ResolvedCart | null>(null);
  const [loading, startLoading] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [done, setDone] = useState<{ orderNumber: string; whatsappUrl: string } | null>(
    null,
  );
  const [country, setCountry] = useState<Country>(initialCountry);
  const [state, setState] = useState("");

  // Cupón: solo el CÓDIGO viaja al servidor; el descuento lo calcula él.
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, setCouponPending] = useState(false);

  // Kora Cashback: solo viaja el importe PEDIDO. Cuánto se aplica de verdad lo
  // decide el servidor leyendo el libro — igual que con el cupón.
  const [usarCashback, setUsarCashback] = useState(false);

  // Token de idempotencia: el mismo durante toda esta sesión de checkout, así
  // un doble clic o un reintento no crean dos pedidos.
  const checkoutToken = useRef(
    `chk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
  );

  useEffect(() => {
    if (!ready) return;
    startLoading(async () => setCart(await getResolvedCart(lines)));
    // Solo al montar: si el carrito cambiara mientras se llena el formulario,
    // no queremos re-render que borre lo digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const buyable = useMemo(
    () => cart?.lines.filter((l) => !l.unavailable && l.qtyAvailable > 0) ?? [],
    [cart],
  );

  const submit = (formData: FormData) => {
    setError(null);
    const payload = {
      checkoutToken: checkoutToken.current,
      couponCode: coupon?.code ?? "",
      cashbackRequested: cashbackAplicable,
      country,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      address: String(formData.get("address") ?? ""),
      address2: String(formData.get("address2") ?? ""),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
      neighborhood: String(formData.get("neighborhood") ?? ""),
      zip: String(formData.get("zip") ?? ""),
      document: String(formData.get("document") ?? ""),
      documentType: String(formData.get("documentType") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      paymentPreference: String(formData.get("paymentPreference") ?? ""),
      acceptsData: formData.get("acceptsData") === "on",
      acceptsMarketing: formData.get("acceptsMarketing") === "on",
    };

    startSubmit(async () => {
      const result = await createOrder(lines, payload);
      if (result.ok) {
        clear(); // el carrito se vacía SOLO con el pedido ya creado
        setDone({ orderNumber: result.orderNumber, whatsappUrl: result.whatsappUrl });
      } else {
        setError({ message: result.error, field: result.field });
      }
    });
  };

  if (done) {
    return <OrderBridge orderNumber={done.orderNumber} whatsappUrl={done.whatsappUrl} />;
  }

  if (!ready || (loading && !cart)) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-7 animate-spin text-[#b3b8c0]" />
      </div>
    );
  }

  if (buyable.length === 0) {
    return (
      <div className="mx-auto max-w-[1040px] px-4 py-20 text-center sm:px-[22px]">
        <h1 className="text-2xl font-bold text-kora-black">No hay nada que pedir</h1>
        <p className="mt-2 text-[13.5px] text-[#8a8f98]">
          Tu carrito está vacío o los productos ya no están disponibles.
        </p>
        <Link
          href="/catalogo"
          className="bg-kora-gradient mt-6 inline-block rounded-full px-6 py-3.5 text-[14px] font-bold text-white hover:opacity-90"
        >
          Ver el catálogo
        </Link>
      </div>
    );
  }

  const currency = cart!.currency;
  const subtotal = buyable.reduce((sum, l) => sum + l.lineTotal, 0);
  const totalTrasCupon = Math.max(0, subtotal - (coupon?.discount ?? 0));
  // Estimación para la pantalla; la cifra que vale es la del servidor.
  const cashbackAplicable =
    usarCashback && buyer ? Math.min(buyer.cashback, totalTrasCupon) : 0;
  const total = Math.max(0, totalTrasCupon - cashbackAplicable);
  const isCO = country === "CO";
  const fieldError = (name: string) =>
    error?.field === name ? (
      <p className="mt-1 text-[11.5px] font-semibold text-destructive">{error.message}</p>
    ) : null;

  return (
    <div className="mx-auto max-w-[1040px] px-4 pt-5 pb-16 sm:px-[22px] sm:pt-6">
      <Link
        href="/carrito"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[#8a8f98] hover:text-kora-black"
      >
        <ArrowLeft className="size-4" /> Volver al carrito
      </Link>
      <h1 className="mb-1 text-[23px] font-bold text-kora-black sm:text-[30px]">Finalizar pedido</h1>
      <p className="mb-6 text-[13.5px] text-[#8a8f98]">
        Completa tus datos y te llevamos a WhatsApp para confirmar el pedido.
      </p>

      <form action={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:rounded-[20px] sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-kora-black">Tus datos</h2>
              <label className="flex items-center gap-2 text-[12.5px] text-[#6b6f78]">
                País
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value as Country);
                    setState("");
                  }}
                  className="min-h-11 rounded-[9px] border-[1.6px] border-[#e2ddd6] px-2.5 py-1.5 text-[12.5px] font-semibold text-kora-black outline-none focus:border-kora-coral"
                >
                  <option value="CO">Colombia</option>
                  <option value="US">Estados Unidos</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="name">
                  {isCO ? "Nombre completo" : "Full name"}
                </label>
                <input id="name" name="name" required className={inputCls}
                  defaultValue={buyer?.name ?? ""}
                  placeholder={isCO ? "Ej. Laura Gómez" : "Ex. John Smith"} />
                {fieldError("name")}
              </div>

              <div>
                <label className={labelCls} htmlFor="phone">
                  {isCO ? "Celular (WhatsApp)" : "Phone"}
                </label>
                <div className="flex items-center gap-2">
                  <span className="rounded-[11px] bg-[#f5f3f0] px-3 py-3 text-sm font-semibold text-[#6b6f78]">
                    {isCO ? "+57" : "+1"}
                  </span>
                  <input id="phone" name="phone" required inputMode="tel"
                    className={inputCls}
                    defaultValue={buyer?.phone ?? ""}
                    placeholder={isCO ? "300 123 4567" : "(305) 555-0123"} />
                </div>
                {fieldError("phone")}
              </div>

              <div>
                <label className={labelCls} htmlFor="email">
                  {isCO ? "Correo electrónico" : "Email"}
                </label>
                <input id="email" name="email" type="email" required className={inputCls}
                  defaultValue={buyer?.email ?? ""}
                  readOnly={Boolean(buyer)}
                  placeholder="correo@ejemplo.com" />
                {/* Con sesión el correo es la credencial de acceso: se cambia
                    desde la cuenta, no aquí. */}
                {buyer && (
                  <p className="mt-1 text-[11.5px] text-[#9aa0ab]">
                    Es el correo de tu cuenta. Para cambiarlo, entra a Mi cuenta.
                  </p>
                )}
                {fieldError("email")}
              </div>

              {isCO && (
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="document">
                    Documento de identidad
                    <span className="ml-1 font-normal text-[#9aa0ab]">
                      (lo exigen las transportadoras)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      name="documentType"
                      aria-label="Tipo de documento"
                      className="w-24 shrink-0 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-3 py-3 text-sm outline-none focus:border-kora-coral"
                    >
                      {DOCUMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input id="document" name="document" required inputMode="numeric"
                      className={inputCls} placeholder="1020304050" />
                  </div>
                  {fieldError("document")}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:rounded-[20px] sm:p-7">
            <h2 className="mb-5 text-lg font-bold text-kora-black">
              {isCO ? "Dirección de entrega" : "Shipping address"}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="state">
                  {isCO ? "Departamento" : "State"}
                </label>
                <select id="state" name="state" required value={state}
                  onChange={(e) => setState(e.target.value)} className={inputCls}>
                  <option value="">{isCO ? "Selecciona…" : "Select…"}</option>
                  {isCO
                    ? DEPARTAMENTOS_CO.map((d) => <option key={d} value={d}>{d}</option>)
                    : US_STATES.map((s) => (
                        <option key={s.code} value={s.name}>{s.name}</option>
                      ))}
                </select>
                {fieldError("state")}
              </div>

              <div>
                <label className={labelCls} htmlFor="city">
                  {isCO ? "Ciudad / Municipio" : "City"}
                </label>
                <input id="city" name="city" required className={inputCls}
                  list={isCO ? "ciudades" : undefined}
                  placeholder={isCO ? "Ej. Bogotá" : "Ex. Miami"} />
                {isCO && (
                  <datalist id="ciudades">
                    {(CIUDADES_SUGERIDAS[state] ?? []).map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                )}
                {fieldError("city")}
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="address">
                  {isCO ? "Dirección" : "Street address"}
                </label>
                <input id="address" name="address" required className={inputCls}
                  placeholder={isCO ? "Ej.: Carrera 7 # 82 - 15" : "Ex. 123 Main St"} />
                {fieldError("address")}
              </div>

              <div>
                <label className={labelCls} htmlFor="address2">
                  {isCO ? "Apto / Torre / Conjunto" : "Apt / Suite"}
                  <span className="ml-1 font-normal text-[#9aa0ab]">(opcional)</span>
                </label>
                <input id="address2" name="address2" className={inputCls} />
              </div>

              {isCO ? (
                <div>
                  <label className={labelCls} htmlFor="neighborhood">Barrio</label>
                  <input id="neighborhood" name="neighborhood" required className={inputCls}
                    placeholder="Ej. Chapinero" />
                  {fieldError("neighborhood")}
                </div>
              ) : (
                <div>
                  <label className={labelCls} htmlFor="zip">ZIP code</label>
                  <input id="zip" name="zip" required className={inputCls}
                    placeholder="33101" />
                  {fieldError("zip")}
                </div>
              )}

              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="notes">
                  {isCO ? "Notas de entrega" : "Delivery notes"}
                  <span className="ml-1 font-normal text-[#9aa0ab]">(opcional)</span>
                </label>
                <textarea id="notes" name="notes" rows={2} className={`${inputCls} resize-y`}
                  placeholder={isCO ? "Ej. Dejar en portería" : "Ex. Leave at the door"} />
              </div>
            </div>
          </section>

          <section className="rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:rounded-[20px] sm:p-7">
            <h2 className="mb-2 text-lg font-bold text-kora-black">
              {isCO ? "¿Cómo prefieres pagar?" : "Preferred payment"}
            </h2>
            <p className="mb-4 text-[12.5px] text-[#8a8f98]">
              El pago se coordina contigo por WhatsApp; aquí solo nos dices tu
              preferencia.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {PAYMENT_METHODS[country].map((method, i) => (
                <label
                  key={method}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[13px] border-[1.8px] border-[#e2ddd6] px-4 py-3.5 text-sm has-checked:border-kora-coral has-checked:bg-[#FFF4EF]"
                >
                  <input type="radio" name="paymentPreference" value={method}
                    defaultChecked={i === 0} required className="accent-kora-coral" />
                  {method}
                </label>
              ))}
            </div>
            {fieldError("paymentPreference")}

            {/* Habeas Data (Ley 1581): aceptación explícita y obligatoria. */}
            <div className="mt-5 space-y-2.5 border-t border-[#f0ece6] pt-5">
              {/* `py-2` no es aire decorativo: la casilla mide 13 px, así que
                  el área que se toca es la ETIQUETA. Sin altura propia queda en
                  ~30 px, por debajo del mínimo táctil, y fallar el toque en la
                  única casilla obligatoria del checkout es perder la venta. */}
              <label className="flex items-start gap-2.5 py-2 text-[12.5px] text-[#4a4f58]">
                <input type="checkbox" name="acceptsData" required
                  className="mt-0.5 size-[18px] shrink-0 accent-kora-coral" />
                <span>
                  Autorizo el tratamiento de mis datos personales para gestionar
                  este pedido, conforme a la{" "}
                  {/* En pestaña nueva a propósito: navegar dentro de la misma
                      perdería el formulario a medio llenar y el comprador
                      tendría que empezar de cero por leer lo que autoriza. */}
                  <a
                    href="/legal/datos-personales"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-kora-coral underline underline-offset-2 hover:opacity-80"
                  >
                    política de tratamiento de datos
                  </a>
                  .
                </span>
              </label>
              <label className="flex items-start gap-2.5 py-2 text-[12.5px] text-[#4a4f58]">
                <input type="checkbox" name="acceptsMarketing"
                  className="mt-0.5 size-[18px] shrink-0 accent-kora-coral" />
                <span>
                  Quiero recibir novedades y promociones de KORA.
                  <span className="text-[#9aa0ab]"> (opcional)</span>
                </span>
              </label>
              {fieldError("acceptsData")}

              <p className="pt-1 text-[12px] leading-relaxed text-[#9aa0ab]">
                Al crear el pedido aceptas nuestros{" "}
                <a
                  href="/legal/terminos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-[#4a4f58]"
                >
                  términos y condiciones
                </a>{" "}
                y la{" "}
                <a
                  href="/legal/cambios"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-[#4a4f58]"
                >
                  política de cambios y garantía
                </a>
                .
              </p>
            </div>
          </section>
        </div>

        {/* Resumen. En móvil se colapsa (diseño §05): entre el formulario y el
            botón final, la lista de artículos con sus fotos añade una pantalla
            entera de recorrido a alguien que ya decidió comprar. En escritorio
            va abierto y pegado a la derecha, como siempre. */}
        <details
          open
          className="group rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:p-6 lg:sticky lg:top-[140px] lg:[&>*:not(summary)]:!block"
        >
          <summary className="mb-4 flex cursor-pointer list-none items-center justify-between text-[17px] font-bold text-kora-black lg:pointer-events-none [&::-webkit-details-marker]:hidden">
            Tu pedido
            <span className="flex items-center gap-2 lg:hidden">
              <span className="text-[15px] font-extrabold">{formatMoney(total, currency)}</span>
              <ChevronDown
                className="size-5 text-[#b3b8c0] transition-transform group-open:rotate-180"
                aria-hidden
              />
            </span>
          </summary>
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {buyable.map((l) => (
              <div key={l.variantId} className="flex items-center gap-3">
                <div
                  className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
                  style={{ background: l.imageUrl ? "#f7f4f0" : l.categoryColor }}
                >
                  {l.imageUrl ? (
                    <Image src={l.imageUrl} alt="" fill sizes="48px"
                      className="object-contain p-1" unoptimized />
                  ) : (
                    <CategoryTile color="transparent" icon={l.categoryIcon} size={48} radius={0} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-kora-black">
                    {l.productName}
                  </p>
                  <p className="text-[11.5px] text-[#8a8f98]">
                    {l.qtyAvailable} × {formatMoney(l.unitPrice, currency)}
                  </p>
                </div>
                <p className="text-[13px] font-bold text-kora-black">
                  {formatMoney(l.lineTotal, currency)}
                </p>
              </div>
            ))}
          </div>

          <div className="my-4 h-px bg-[#efe9e1]" />

          {/* Canje del cupón (CUP_HU004 §1). Un solo cupón por pedido. */}
          {coupon ? (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-[10px] border border-[#ffd9c7] bg-[#FFF4EF] px-3 py-2.5">
              <div className="min-w-0">
                <span className="font-mono text-[12.5px] font-bold text-kora-black">
                  {coupon.code}
                </span>
                <span className="ml-2 text-[12.5px] text-[#8a5a2b]">
                  −{formatMoney(coupon.discount, currency)}
                </span>
              </div>
              <button
                type="button"
                aria-label="Quitar cupón"
                onClick={() => {
                  setCoupon(null);
                  setCouponError(null);
                }}
                className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[12px] font-bold text-[#8a5a2b]"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="mb-3">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]">
                ¿Tienes un cupón?
              </label>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO"
                  className="min-w-0 flex-1 rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3 py-2.5 font-mono text-[13px] outline-none focus:border-kora-coral"
                />
                <button
                  type="button"
                  disabled={couponPending || !couponInput.trim()}
                  onClick={async () => {
                    setCouponPending(true);
                    setCouponError(null);
                    const r = await applyCoupon(couponInput, lines, {});
                    if (r.ok) {
                      setCoupon({ code: r.code, discount: r.discount });
                      setCouponInput("");
                    } else {
                      setCouponError(r.error);
                    }
                    setCouponPending(false);
                  }}
                  className="shrink-0 rounded-[10px] border-[1.6px] border-[#e2ddd6] px-4 text-[13px] font-semibold text-kora-black disabled:opacity-50"
                >
                  {couponPending ? "…" : "Aplicar"}
                </button>
              </div>
              {couponError && (
                <p className="mt-1.5 text-[12px] text-destructive">{couponError}</p>
              )}
            </div>
          )}

          {/* Kora Cashback. Solo con sesión: sin cuenta, la identidad del
              comprador sería el correo que escribió, y eso dejaría gastar el
              saldo ajeno. Y no se combina con cupón — regla del cliente. */}
          {buyer && buyer.cashback > 0 && (
            <div className="mb-3">
              <label
                className={`flex items-center gap-2.5 rounded-[10px] border-[1.6px] px-3 py-2.5 ${
                  coupon
                    ? "cursor-not-allowed border-[#e2ddd6] opacity-60"
                    : "cursor-pointer border-[#ffd9c7] bg-[#FFF4EF]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={usarCashback}
                  disabled={Boolean(coupon)}
                  onChange={(e) => setUsarCashback(e.target.checked)}
                  className="size-4 accent-kora-orange"
                />
                <span className="text-[12.5px] text-kora-black">
                  Usar mi Kora Cashback
                  <span className="ml-1.5 font-bold">
                    ({formatMoney(buyer.cashback, currency)} disponible)
                  </span>
                </span>
              </label>
              {coupon && (
                <p className="mt-1.5 text-[12px] text-[#8a8f98]">
                  No puedes usar un cupón y tu Kora Cashback en la misma compra.
                </p>
              )}
            </div>
          )}

          {(coupon || cashbackAplicable > 0) && (
            <div className="mb-2 flex items-baseline justify-between text-[13px]">
              <span className="text-[#6b6f78]">Subtotal</span>
              <span className="text-kora-black">{formatMoney(subtotal, currency)}</span>
            </div>
          )}

          {cashbackAplicable > 0 && (
            <div className="mb-2 flex items-baseline justify-between text-[13px]">
              <span className="text-[#6b6f78]">Kora Cashback</span>
              <span className="text-kora-black">
                −{formatMoney(cashbackAplicable, currency)}
              </span>
            </div>
          )}

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-kora-black">Total</span>
            <span className="text-[22px] font-extrabold text-kora-black">
              {formatMoney(total, currency)} {currency}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] text-[#8a8f98]">
            El envío se acuerda por WhatsApp.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="bg-kora-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-bold text-white shadow-[0_10px_26px_rgba(255,90,31,0.32)] hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Creando pedido…" : "Confirmar y enviar por WhatsApp"}
          </button>

          {error && !error.field && (
            <p className="mt-3 text-center text-[12.5px] font-semibold text-destructive">
              {error.message}
            </p>
          )}
          {error?.field && (
            <p className="mt-3 text-center text-[12.5px] font-semibold text-destructive">
              Revisa los datos marcados arriba.
            </p>
          )}

          <p className="mt-4 flex items-start gap-2 border-t border-[#efe9e1] pt-4 text-[11.5px] text-[#8a8f98]">
            <ShieldCheck className="size-4 shrink-0 text-kora-coral" />
            Tu pedido queda registrado en KORA antes de abrir WhatsApp.
          </p>
        </details>
      </form>
    </div>
  );
}
