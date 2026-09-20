"use client";

// Checkout de un solo paso (PED_HU001): datos del comprador + resumen.
// Al enviar se crea el pedido y se pasa a la pantalla puente que abre WhatsApp.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Flame, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { useCart } from "@/modules/cart/cart-context";
import {
  huellaDeCarrito,
  leerPedidoSinEnviar,
  olvidarPedidoSinEnviar,
  recordarPedidoSinEnviar,
  type PedidoSinEnviar,
} from "@/modules/cart/pedido-sin-enviar";
import { applyCoupon } from "@/modules/coupons/apply-action";
import { getResolvedCart } from "@/modules/cart/actions";
import type { ResolvedCart } from "@/modules/cart/resolve";
import { createOrder } from "@/modules/orders/checkout-actions";
import { formatMoney } from "@/modules/pricing";
import { variantDetails } from "@/modules/orders/message";
import { SelectorDivisionCiudad } from "../_components/selector-ciudad";
import { ciudadCanonica } from "@/modules/geo/places";
import { DOCUMENT_TYPES, PAYMENT_METHODS } from "@/modules/orders/geo";
import { CategoryTile } from "@/modules/catalog/tiles";
import type { Address } from "@/modules/customers/addresses";
import type { UltimaFacturacion } from "@/modules/buyer/orders";
import { OrderBridge } from "./order-bridge";
import { PantallaProceso } from "./pantalla-proceso";
import { InvitacionCuenta } from "./invitacion-cuenta";
import { guardarDireccionDelPedido } from "../cuenta/direcciones-actions";

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
  /** Libreta del comprador (alcance nuevo, 1 sep 2026). Vacía = sin sesión o
   *  sin direcciones guardadas: el checkout entonces es el de siempre.
   *  Es la libreta de ENVÍO: direcciones en Colombia. */
  direcciones: Address[];
  /** Con qué facturó la última vez, para precargar "Quién paga". */
  facturacion: UltimaFacturacion | null;
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
  const [done, setDone] = useState<{
    orderNumber: string;
    whatsappUrl: string;
    account: "none" | "exists";
    cashbackPrevisto: string | null;
  } | null>(null);
  // Se pasa a WhatsApp cuando el comprador decide: creando la cuenta o
  // diciendo "en otro momento". Nunca se salta la invitación sola.
  const [seguirYa, setSeguirYa] = useState(false);
  // La pantalla de proceso terminó de contarse. Se espera A LAS DOS COSAS —el
  // servidor y el relato— porque el servidor responde en unos 300 ms y sin esto
  // la pantalla sería un parpadeo.
  const [procesoContado, setProcesoContado] = useState(false);
  // ── Datos de facturación (change direccion-facturacion-y-envio, 20 sep 2026) ──
  // Quien paga. Su país arranca desde la moneda (PED_HU001 §1) o desde su
  // última facturación con sesión, y gobierna SU bloque: prefijo del teléfono,
  // documento, campos de dirección y métodos de pago. No gobierna el envío.
  // No va al chat de WhatsApp: es dato del panel, del comprobante y, el día que
  // exista pasarela, de la validación de la tarjeta.
  //
  // Campos CONTROLADOS, a propósito: los datos de envío se precargan con estos
  // y para copiar valores hay que tenerlos en estado, no en el DOM.
  const facturacion = buyer?.facturacion ?? null;
  const [country, setCountry] = useState<Country>(facturacion?.country ?? initialCountry);
  const [fact, setFact] = useState({
    name: buyer?.name ?? "",
    phone: buyer?.phone ?? "",
    email: buyer?.email ?? "",
    documentType: "CC",
    document: facturacion?.document ?? "",
    state: facturacion?.state ?? "",
    city: facturacion?.city ?? "",
    address: facturacion?.address ?? "",
    address2: facturacion?.address2 ?? "",
    neighborhood: facturacion?.neighborhood ?? "",
    zip: facturacion?.zip ?? "",
  });
  const setF = (patch: Partial<typeof fact>) => setFact((f) => ({ ...f, ...patch }));

  // ── Datos de envío: SIEMPRE Colombia ──
  // KORA no envía a EE.UU. (decisión del cliente, 13 sep 2026): quien compra
  // en USD está allá y manda el pedido a un familiar acá. Con pagador en
  // Colombia, la casilla "usar los mismos datos" (marcada por omisión)
  // PRECARGA el envío con la facturación: los campos siguen visibles y
  // editables —Daniel, 20 sep—, y tocar uno desmarca la casilla, para que el
  // "misma dirección" que se guarda en el pedido sea verdad. Con pagador en
  // EE.UU. la casilla no existe: la entrega no puede ser la misma.
  const [mismaDireccion, setMismaDireccion] = useState(true);
  const mismosDatos = country === "CO" && mismaDireccion;
  const [envioPropio, setEnvioPropio] = useState({
    name: "",
    phone: "",
    document: "",
    state: "",
    city: "",
    address: "",
    address2: "",
    neighborhood: "",
    notes: "",
  });
  const envio = mismosDatos
    ? {
        name: fact.name,
        phone: fact.phone,
        document: fact.document,
        state: fact.state,
        city: fact.city,
        address: fact.address,
        address2: fact.address2,
        neighborhood: fact.neighborhood,
        notes: envioPropio.notes,
      }
    : envioPropio;
  /** Editar un campo de envío: si venía copiado, se queda con la copia y se desmarca. */
  const setE = (patch: Partial<typeof envioPropio>) => {
    if (mismosDatos) {
      setEnvioPropio({ ...envio, ...patch });
      setMismaDireccion(false);
    } else {
      setEnvioPropio((e) => ({ ...e, ...patch }));
    }
  };

  // ── Libreta de direcciones (alcance nuevo, 1 sep 2026) ──
  // Solo alimenta los datos de ENVÍO. Elegir una la copia a los campos, que
  // siguen editables; "usar otra dirección" los vacía.
  const direcciones = buyer?.direcciones ?? [];
  const [direccionId, setDireccionId] = useState<string | null>(null);

  /**
   * ¿A esta dirección guardada le falta algo para poder entregarla?
   *
   * Las del backfill son texto libre sin departamento ni barrio; las guardadas
   * en EE.UU. antes del 20 sep 2026 no sirven como destino. Se enseñan
   * marcadas para que el comprador complete lo que falte.
   */
  const incompleta = (d: Address | null) =>
    !!d &&
    (!d.address?.trim() ||
      !d.city?.trim() ||
      !d.state?.trim() ||
      !d.neighborhood?.trim() ||
      d.country !== "CO" ||
      !ciudadCanonica("CO", d.state ?? "", d.city ?? ""));

  /** Elegir una dirección de la libreta llena los datos de envío. */
  const elegirDireccion = (id: string | null) => {
    setDireccionId(id);
    setMismaDireccion(false);
    const d = direcciones.find((x) => x.id === id);
    setEnvioPropio((e) => ({
      ...e,
      state: d?.state ?? "",
      city: d?.city ?? "",
      address: d?.address ?? "",
      address2: d?.address2 ?? "",
      neighborhood: d?.neighborhood ?? "",
      notes: d?.notes ?? "",
    }));
  };
  const [guardarNueva, setGuardarNueva] = useState(false);


  // Cupón: solo el CÓDIGO viaja al servidor; el descuento lo calcula él.
  // La casilla de datos es lo único obligatorio que no es un campo de texto,
  // y el botón está en otra columna. Con `required` a secas, el navegador
  // mostraba un globo que en móvil dura un instante, y la primera persona
  // que probó la tienda creyó que "el botón no funciona" (12 sep 2026). El
  // botón se apaga hasta que se acepta, y dice por qué.
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const casillaDatosRef = useRef<HTMLInputElement>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, setCouponPending] = useState(false);

  // Kora Cashback: solo viaja el importe PEDIDO. Cuánto se aplica de verdad lo
  // decide el servidor leyendo el libro — igual que con el cupón.
  const [usarCashback, setUsarCashback] = useState(false);

  // ¿Hay un pedido creado que nunca llegó a WhatsApp? Se lee al montar, no en
  // el render: `localStorage` no existe en el servidor.
  const [pendiente, setPendiente] = useState<PedidoSinEnviar | null>(null);
  useEffect(() => setPendiente(leerPedidoSinEnviar()), []);

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
    const campo = (name: string) => String(formData.get(name) ?? "");
    // Dos bloques anidados, con los nombres `billing.*` y `shipping.*` del
    // formulario. Con "misma dirección" el envío NO viaja: lo deriva el
    // servidor del pagador. Un segundo juego de campos escondido es justo lo
    // que se quiere evitar.
    const payload = {
      checkoutToken: checkoutToken.current,
      couponCode: coupon?.code ?? "",
      cashbackRequested: cashbackAplicable,
      billing: {
        country,
        name: campo("billing.name"),
        email: campo("billing.email"),
        phone: campo("billing.phone"),
        document: campo("billing.document"),
        documentType: campo("billing.documentType"),
        address: campo("billing.address"),
        address2: campo("billing.address2"),
        city: campo("billing.city"),
        state: campo("billing.state"),
        neighborhood: campo("billing.neighborhood"),
        zip: campo("billing.zip"),
      },
      // El envío viaja SIEMPRE tal como se ve —los campos están a la vista y
      // se pueden editar—; la casilla solo dice si el comprador los dejó
      // iguales a la facturación.
      shipSameAsBilling: mismosDatos,
      shipping: {
        country: "CO" as const,
        name: campo("shipping.name"),
        phone: campo("shipping.phone"),
        document: campo("shipping.document"),
        address: campo("shipping.address"),
        address2: campo("shipping.address2"),
        city: campo("shipping.city"),
        state: campo("shipping.state"),
        neighborhood: campo("shipping.neighborhood"),
        zip: "",
        notes: campo("shipping.notes"),
      },
      paymentPreference: campo("paymentPreference"),
      acceptsData: formData.get("acceptsData") === "on",
      acceptsMarketing: formData.get("acceptsMarketing") === "on",
    };

    startSubmit(async () => {
      const result = await createOrder(lines, payload);
      if (result.ok) {
        // ⚠️ El carrito NO se vacía aquí, y antes sí. El pedido ya existe en
        // la base, pero el comprador todavía no ha visto NADA: la pantalla de
        // proceso sigue contándose. Un "atrás" en esa ventana —un misclic, un
        // gesto del trackpad— le dejaba el carrito vacío y un pedido que jamás
        // vio: desde su lado, todo se desvaneció sin saber si compró.
        // Ahora se vacía en el puente de WhatsApp, que es el primer momento en
        // que tiene el número del pedido delante. Lo encontró Daniel probando.
        // Después del pedido y sin bloquearlo: la venta ya está hecha, y una
        // comodidad no puede tumbarla si falla.
        if (buyer && !mismosDatos && direccionId === null && guardarNueva) {
          void guardarDireccionDelPedido({
            country: "CO",
            state: payload.shipping.state,
            city: payload.shipping.city,
            address: payload.shipping.address,
            address2: payload.shipping.address2,
            neighborhood: payload.shipping.neighborhood,
            zip: "",
            notes: payload.shipping.notes,
          }).catch(() => {});
        }

        recordarPedidoSinEnviar({
          orderNumber: result.orderNumber,
          whatsappUrl: result.whatsappUrl,
          huella: huellaDeCarrito(lines),
        });
        setDone({
          orderNumber: result.orderNumber,
          whatsappUrl: result.whatsappUrl,
          account: result.account,
          cashbackPrevisto: result.cashbackPrevisto,
        });
      } else {
        setError({ message: result.error, field: result.field });
      }
    });
  };

  // Mientras el servidor trabaja Y mientras la pantalla termina de contarse.
  // Es la única ventana que el comprador tiene a lo que está pasando, y sin
  // ella algunos vuelven a pulsar.
  //
  // Si el pedido FALLA se sale de aquí de inmediato: hacerle mirar una
  // animación optimista a quien tiene un error esperándole sería burlarse.
  if (!error && (submitting || (done && !procesoContado))) {
    return <PantallaProceso onListo={() => setProcesoContado(true)} />;
  }

  if (done) {
    // Solo se invita a quien todavía no tiene cuenta, y solo hasta que decide.
    if (!seguirYa && !buyer) {
      return (
        <InvitacionCuenta
          orderNumber={done.orderNumber}
          checkoutToken={checkoutToken.current}
          // Lo calcula el SERVIDOR, sobre el total que quedó guardado. Aquí
          // no se recalcula: sería una segunda definición de la misma cifra, y
          // la de esta pantalla podría alejarse de la que acredita el libro.
          cashback={done.cashbackPrevisto}
          tieneCuenta={done.account === "exists"}
          onContinuar={() => setSeguirYa(true)}
        />
      );
    }
    return (
      <OrderBridge
        orderNumber={done.orderNumber}
        whatsappUrl={done.whatsappUrl}
        // Aquí, y no antes: es el primer momento en que el comprador tiene su
        // número de pedido a la vista y el enlace en la mano.
        onLlegada={clear}
        onEnviado={olvidarPedidoSinEnviar}
      />
    );
  }

  // Rescate de un pedido que se creó y nunca llegó a WhatsApp. Va ANTES de
  // los estados de carga y de carrito vacío a propósito: si el comprador
  // volvió atrás y su carrito quedó vacío, este aviso es lo único que le
  // dice que su pedido existe.
  const rescate = pendiente ? (
    <div className="mx-auto mb-6 flex max-w-[1040px] flex-col gap-3 rounded-2xl border border-[#ffd9c2] bg-[#FFF4EF] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-kora-black">
          Tu pedido {pendiente.orderNumber} ya está creado
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#6b6f78]">
          Todavía no lo enviaste por WhatsApp. Ábrelo para confirmarlo con un
          asesor; no hace falta volver a llenar nada.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <a
          href={pendiente.whatsappUrl}
          onClick={() => {
            // Enviar desde aquí cierra el ciclo igual que el puente: el
            // pedido ya va camino de WhatsApp. Pero el carrito se vacía SOLO
            // si sigue siendo el mismo del que salió el pedido — si el
            // comprador volvió atrás y le añadió cosas, vaciarlo le borraría
            // productos que nunca pidió.
            if (pendiente.huella && pendiente.huella === huellaDeCarrito(lines)) {
              clear();
            }
            olvidarPedidoSinEnviar();
            setPendiente(null);
          }}
          className="bg-kora-gradient inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-bold whitespace-nowrap text-white hover:opacity-90"
        >
          <MessageCircle className="size-4" aria-hidden /> Abrir WhatsApp
        </a>
        <button
          type="button"
          onClick={() => {
            olvidarPedidoSinEnviar();
            setPendiente(null);
          }}
          className="text-[12.5px] font-semibold whitespace-nowrap text-[#8a8f98] hover:text-kora-black"
        >
          Descartar
        </button>
      </div>
    </div>
  ) : null;

  if (!ready || (loading && !cart)) {
    return (
      <div className="px-4 pt-6 sm:px-[22px]">
        {rescate}
        <div className="flex justify-center py-20">
          <Loader2 className="size-7 animate-spin text-[#b3b8c0]" />
        </div>
      </div>
    );
  }

  if (buyable.length === 0) {
    return (
      <div className="mx-auto max-w-[1040px] px-4 pt-6 pb-20 text-center sm:px-[22px]">
        {rescate}
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

      {rescate}

      <form action={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:rounded-[20px] sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-kora-black">
                {isCO ? "Datos de facturación" : "Billing details"}
              </h2>
              <label className="flex items-center gap-2 text-[12.5px] text-[#6b6f78]">
                País
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value as Country);
                    setF({ state: "", city: "", neighborhood: "", zip: "" });
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
                <label className={labelCls} htmlFor="billing.name">
                  {isCO ? "Nombre completo" : "Full name"}
                </label>
                <input id="billing.name" name="billing.name" required className={inputCls}
                  value={fact.name} onChange={(e) => setF({ name: e.target.value })}
                  placeholder={isCO ? "Ej. Laura Gómez" : "Ex. John Smith"} />
                {fieldError("billing.name")}
              </div>

              <div>
                <label className={labelCls} htmlFor="billing.phone">
                  {isCO ? "Celular (WhatsApp)" : "Phone"}
                </label>
                <div className="flex items-center gap-2">
                  <span className="rounded-[11px] bg-[#f5f3f0] px-3 py-3 text-sm font-semibold text-[#6b6f78]">
                    {isCO ? "+57" : "+1"}
                  </span>
                  <input id="billing.phone" name="billing.phone" required inputMode="tel"
                    className={inputCls}
                    value={fact.phone} onChange={(e) => setF({ phone: e.target.value })}
                    placeholder={isCO ? "300 123 4567" : "(305) 555-0123"} />
                </div>
                {fieldError("billing.phone")}
              </div>

              <div>
                <label className={labelCls} htmlFor="billing.email">
                  {isCO ? "Correo electrónico" : "Email"}
                </label>
                <input id="billing.email" name="billing.email" type="email" required className={inputCls}
                  value={fact.email} onChange={(e) => setF({ email: e.target.value })}
                  readOnly={Boolean(buyer)}
                  placeholder="correo@ejemplo.com" />
                {/* Con sesión el correo es la credencial de acceso: se cambia
                    desde la cuenta, no aquí. */}
                {buyer && (
                  <p className="mt-1 text-[11.5px] text-[#9aa0ab]">
                    Es el correo de tu cuenta. Para cambiarlo, entra a Mi cuenta.
                  </p>
                )}
                {fieldError("billing.email")}
              </div>

              {isCO && (
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="billing.document">
                    Documento de identidad
                    <span className="ml-1 font-normal text-[#9aa0ab]">
                      (lo exigen las transportadoras)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      name="billing.documentType"
                      aria-label="Tipo de documento"
                      value={fact.documentType}
                      onChange={(e) => setF({ documentType: e.target.value })}
                      className="w-24 shrink-0 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-3 py-3 text-sm outline-none focus:border-kora-coral"
                    >
                      {DOCUMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input id="billing.document" name="billing.document" required inputMode="numeric"
                      className={inputCls} placeholder="1020304050"
                      value={fact.document} onChange={(e) => setF({ document: e.target.value })} />
                  </div>
                  {fieldError("billing.document")}
                </div>
              )}

              {/* Departamento/estado → ciudad, encadenados. */}
              <SelectorDivisionCiudad
                country={country}
                state={fact.state}
                onState={(v) => setF({ state: v })}
                city={fact.city}
                onCity={(v) => setF({ city: v })}
                inputCls={inputCls}
                labelCls={labelCls}
                errorState={fieldError("billing.state")}
                errorCity={fieldError("billing.city")}
                prefijo="billing."
              />

              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="billing.address">
                  {isCO ? "Dirección" : "Billing address"}
                </label>
                <input id="billing.address" name="billing.address" required className={inputCls}
                  value={fact.address} onChange={(e) => setF({ address: e.target.value })}
                  placeholder={isCO ? "Ej.: Carrera 7 # 82 - 15" : "Ex. 123 Main St"} />
                {fieldError("billing.address")}
              </div>

              <div>
                <label className={labelCls} htmlFor="billing.address2">
                  {isCO ? "Apto / Torre / Conjunto" : "Apt / Suite"}
                  <span className="ml-1 font-normal text-[#9aa0ab]">(opcional)</span>
                </label>
                <input id="billing.address2" name="billing.address2" className={inputCls}
                  value={fact.address2} onChange={(e) => setF({ address2: e.target.value })} />
              </div>

              {isCO ? (
                <div>
                  <label className={labelCls} htmlFor="billing.neighborhood">Barrio</label>
                  <input id="billing.neighborhood" name="billing.neighborhood" required className={inputCls}
                    value={fact.neighborhood} onChange={(e) => setF({ neighborhood: e.target.value })}
                    placeholder="Ej. Chapinero" />
                  {fieldError("billing.neighborhood")}
                </div>
              ) : (
                <div>
                  <label className={labelCls} htmlFor="billing.zip">ZIP code</label>
                  <input id="billing.zip" name="billing.zip" required className={inputCls}
                    value={fact.zip} onChange={(e) => setF({ zip: e.target.value })}
                    placeholder="33101" />
                  {fieldError("billing.zip")}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[18px] bg-white p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:rounded-[20px] sm:p-7">
            <h2 className="mb-1 text-lg font-bold text-kora-black">
              {isCO ? "Datos de envío" : "Shipping details"}
            </h2>
            <p className="mb-5 text-[12.5px] text-[#8a8f98]">
              {isCO
                ? "Hacemos envíos dentro de Colombia."
                : "We only ship within Colombia — e.g. to a relative or friend."}
            </p>

            {/* Solo con pagador en Colombia. Marcada, PRECARGA los campos de
                abajo con la facturación; siguen visibles y editables, y tocar
                uno la desmarca. */}
            {isCO && (
              <label className="mb-5 flex cursor-pointer items-center gap-2.5 rounded-[14px] border-[1.6px] border-[#e2ddd6] p-3.5 text-[13.5px] font-semibold text-kora-black has-checked:border-kora-coral has-checked:bg-[#FFF7F3]">
                <input
                  type="checkbox"
                  checked={mismaDireccion}
                  onChange={(e) => {
                    setMismaDireccion(e.target.checked);
                    if (e.target.checked) setDireccionId(null);
                  }}
                  className="size-[18px] accent-kora-coral"
                />
                Usar los mismos datos de facturación
              </label>
            )}

            {direcciones.length > 0 && (
              <div className="mb-5 space-y-2">
                <p className="text-[12.5px] font-semibold text-[#6b6f78]">Mis direcciones guardadas</p>
                {direcciones.map((d) => (
                  <label
                    key={d.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-[14px] border-[1.6px] p-3.5 transition-colors ${
                      direccionId === d.id
                        ? "border-kora-coral bg-[#FFF7F3]"
                        : "border-[#e2ddd6] hover:border-[#d6d0c8]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="direccionGuardada"
                      checked={direccionId === d.id}
                      onChange={() => elegirDireccion(d.id)}
                      className="mt-0.5 size-4 accent-kora-coral"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold text-kora-black">
                        {d.label ? `${d.label} · ` : ""}
                        {[d.address, d.address2].filter(Boolean).join(", ")}
                      </span>
                      <span className="block text-[12.5px] text-[#6b6f78]">
                        {[d.neighborhood, d.city, d.state].filter(Boolean).join(", ")}
                      </span>
                    </span>
                    {d.isDefault && (
                      <span className="shrink-0 rounded-full bg-[#FFF4EF] px-2 py-0.5 text-[10.5px] font-bold text-kora-coral">
                        Predeterminada
                      </span>
                    )}
                    {incompleta(d) && (
                      <span className="shrink-0 rounded-full bg-[#FFF4EF] px-2 py-0.5 text-[10.5px] font-bold text-kora-coral">
                        Falta información
                      </span>
                    )}
                  </label>
                ))}
                <p className="text-[12px] text-[#8a8f98]">
                  Al elegir una se copian sus datos abajo y puedes ajustarlos. Administra tu libreta en{" "}
                  <Link href="/cuenta?seccion=direcciones" className="font-semibold text-kora-coral underline underline-offset-2">
                    Mis direcciones
                  </Link>
                  .
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="shipping.name">Nombre de quien recibe</label>
                <input id="shipping.name" name="shipping.name" required className={inputCls}
                  value={envio.name} onChange={(e) => setE({ name: e.target.value })}
                  placeholder="Ej. Rosa Gómez" />
                {fieldError("shipping.name")}
              </div>

              <div>
                <label className={labelCls} htmlFor="shipping.phone">Celular de quien recibe</label>
                <div className="flex items-center gap-2">
                  <span className="rounded-[11px] bg-[#f5f3f0] px-3 py-3 text-sm font-semibold text-[#6b6f78]">+57</span>
                  <input id="shipping.phone" name="shipping.phone" required inputMode="tel" className={inputCls}
                    value={envio.phone} onChange={(e) => setE({ phone: e.target.value })}
                    placeholder="300 123 4567" />
                </div>
                {fieldError("shipping.phone")}
              </div>

              <div>
                <label className={labelCls} htmlFor="shipping.document">
                  Documento de quien recibe
                  <span className="ml-1 font-normal text-[#9aa0ab]">(opcional)</span>
                </label>
                <input id="shipping.document" name="shipping.document" inputMode="numeric" className={inputCls}
                  value={envio.document} onChange={(e) => setE({ document: e.target.value })}
                  placeholder="1020304050" />
              </div>

              {/* Departamento → municipio, encadenados: desplegable cerrado
                  (DANE completo). Siempre Colombia. */}
              <SelectorDivisionCiudad
                country="CO"
                state={envio.state}
                onState={(v) => setE({ state: v })}
                city={envio.city}
                onCity={(v) => setE({ city: v })}
                inputCls={inputCls}
                labelCls={labelCls}
                errorState={fieldError("shipping.state")}
                errorCity={fieldError("shipping.city")}
                prefijo="shipping."
              />

              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="shipping.address">
                  {isCO ? "Dirección" : "Street address (Colombia)"}
                </label>
                <input id="shipping.address" name="shipping.address" required className={inputCls}
                  value={envio.address} onChange={(e) => setE({ address: e.target.value })}
                  placeholder="Ej.: Carrera 7 # 82 - 15" />
                {fieldError("shipping.address")}
              </div>

              <div>
                <label className={labelCls} htmlFor="shipping.address2">
                  {isCO ? "Apto / Torre / Conjunto" : "Apt / Tower"}
                  <span className="ml-1 font-normal text-[#9aa0ab]">(opcional)</span>
                </label>
                <input id="shipping.address2" name="shipping.address2" className={inputCls}
                  value={envio.address2} onChange={(e) => setE({ address2: e.target.value })} />
              </div>

              <div>
                <label className={labelCls} htmlFor="shipping.neighborhood">
                  {isCO ? "Barrio" : "Neighborhood (barrio)"}
                </label>
                <input id="shipping.neighborhood" name="shipping.neighborhood" required className={inputCls}
                  value={envio.neighborhood} onChange={(e) => setE({ neighborhood: e.target.value })}
                  placeholder="Ej. Chapinero" />
                {fieldError("shipping.neighborhood")}
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="shipping.notes">
                  {isCO ? "Notas de entrega" : "Delivery notes"}
                  <span className="ml-1 font-normal text-[#9aa0ab]">(opcional)</span>
                </label>
                <textarea id="shipping.notes" name="shipping.notes" rows={2} className={`${inputCls} resize-y`}
                  value={envio.notes}
                  onChange={(e) => (mismosDatos ? setEnvioPropio((x) => ({ ...x, notes: e.target.value })) : setE({ notes: e.target.value }))}
                  placeholder={isCO ? "Ej. Dejar en portería" : "Ex. Leave at the front desk"} />
              </div>

              {/* Solo con sesión y con una dirección escrita a mano: sin cuenta
                  no hay libreta, y una copiada de la libreta ya está en ella. */}
              {buyer && !mismosDatos && direccionId === null && (
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[#4a4f58] sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={guardarNueva}
                    onChange={(e) => setGuardarNueva(e.target.checked)}
                    className="size-4 accent-kora-coral"
                  />
                  Guardar esta dirección en mi cuenta
                </label>
              )}
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
                <input type="checkbox" name="acceptsData" required ref={casillaDatosRef}
                  checked={aceptaDatos} onChange={(e) => setAceptaDatos(e.target.checked)}
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
                  {/* Lo que eligió —talla, color— va aquí, no solo en el
                      carrito: el resumen del checkout es lo último que ve
                      antes de mandar el pedido, y una talla equivocada se
                      descubría en la conversación de WhatsApp. */}
                  {variantDetails(l.variantName).length > 0 && (
                    <p className="truncate text-[11.5px] font-medium text-[#4a4f58]">
                      {variantDetails(l.variantName).join(" · ")}
                    </p>
                  )}
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
                {/* La llama es la marca del cashback en toda la tienda (el
                    badge de precio online usa la misma). Sin ella, la casilla
                    se lee como una opción más y pasa desapercibida — que es
                    justo lo que le pasa al saldo que el comprador ya se ganó. */}
                <Flame className="size-4 shrink-0 text-kora-orange" aria-hidden />
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

          {/* Sin sesión NO se puede usar el saldo —la identidad sería el correo
              que alguien escribió, y eso deja gastar el saldo ajeno—, pero
              callarlo hace que el comprador no sepa que existe. Este es el
              único sitio donde se entera justo cuando le sirve. */}
          {!buyer && (
            <div className="mb-3 flex items-start gap-2.5 rounded-[10px] border-[1.6px] border-[#ffd9c7] bg-[#FFF4EF] px-3 py-2.5">
              <Flame className="mt-px size-4 shrink-0 text-kora-orange" aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-kora-black">
                ¿Tienes Kora Cashback?{" "}
                <Link
                  href="/cuenta/entrar?volver=/checkout"
                  className="font-bold text-kora-orange underline underline-offset-2"
                >
                  Inicia sesión
                </Link>{" "}
                para descontarlo de esta compra.
              </p>
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
            disabled={submitting || !aceptaDatos}
            aria-describedby={!aceptaDatos ? "falta-autorizacion" : undefined}
            className="bg-kora-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-bold text-white shadow-[0_10px_26px_rgba(255,90,31,0.32)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:grayscale-[35%]"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Creando pedido…" : "Confirmar y enviar por WhatsApp"}
          </button>

          {/* Un botón apagado sin explicación es un botón "que no funciona".
              Esto dice qué falta y lleva hasta la casilla. */}
          {!aceptaDatos && !submitting && (
            <button
              type="button"
              id="falta-autorizacion"
              onClick={() => {
                casillaDatosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                casillaDatosRef.current?.focus();
              }}
              className="mt-2.5 w-full text-center text-[12.5px] font-semibold text-kora-coral underline-offset-2 hover:underline"
            >
              Para continuar, acepta el tratamiento de tus datos
            </button>
          )}

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
