"use client";

// La caja (change s09-pos-caja), contra el prototipo: buscador/escáner,
// categorías y grilla a la izquierda; ticket en curso a la derecha.
// El ticket solo guarda variante + cantidad: el precio que se cobra lo
// resuelve el servidor (precio de tienda en COP).
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, FileText, FlaskConical, Minus, Plus, Printer, ScanBarcode, Search, Trash2, X } from "lucide-react";
import { formatMoney } from "@/modules/pricing";
import type { PosCategory, PosProduct } from "@/modules/pos/catalog";
import { buscarClienteCaja, cobrarVentaPos } from "@/modules/pos/actions";
import { Switch } from "@/components/ui/switch";
import { PASOS_FACTURA, pasosCobro, ProcesoCobro } from "./proceso-cobro";

type Linea = { variantId: string; qty: number };

// El ticket sobrevive a una recarga accidental de la pestaña: perder la
// venta a medio armar delante del cliente es lo peor que le puede pasar a una caja.
const TICKET_KEY = "kora_pos_ticket";

const money = (n: number) => formatMoney(n, "COP");

export function PosView({
  products,
  categories,
  methods,
  canSell,
}: {
  products: PosProduct[];
  categories: PosCategory[];
  methods: string[];
  canSell: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Linea[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState(false);
  const buscadorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TICKET_KEY);
      if (raw) setTicket(JSON.parse(raw) as Linea[]);
    } catch {}
    buscadorRef.current?.focus();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(TICKET_KEY, JSON.stringify(ticket));
    } catch {}
  }, [ticket]);

  const porId = useMemo(() => new Map(products.map((p) => [p.variantId, p])), [products]);

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Los agotados NO se esconden —si el vendedor busca uno y no aparece,
    // pensará que lo borraron—, pero van al final: lo que se ve primero es lo
    // que se puede vender. `sort` es estable: el orden alfabético se conserva
    // dentro de cada grupo.
    return products
      .filter((p) => {
      if (categoria && p.categoryId !== categoria) return false;
      if (!q) return true;
      return (
        p.productName.toLowerCase().includes(q) ||
        p.variantName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").includes(q)
      );
      })
      .sort((a, b) => Number(a.stock <= 0) - Number(b.stock <= 0));
  }, [products, query, categoria]);

  const lineas = ticket
    .map((l) => ({ ...l, p: porId.get(l.variantId) }))
    .filter((l): l is Linea & { p: PosProduct } => Boolean(l.p));
  const total = lineas.reduce((s, l) => s + l.p.price * l.qty, 0);
  const unidades = lineas.reduce((s, l) => s + l.qty, 0);

  function agregar(p: PosProduct) {
    const actual = ticket.find((l) => l.variantId === p.variantId)?.qty ?? 0;
    if (actual + 1 > p.stock) {
      setAviso(`No hay más ${p.productName}: quedan ${p.stock}.`);
      return;
    }
    setAviso(null);
    setTicket((t) =>
      t.some((l) => l.variantId === p.variantId)
        ? t.map((l) => (l.variantId === p.variantId ? { ...l, qty: l.qty + 1 } : l))
        : [...t, { variantId: p.variantId, qty: 1 }],
    );
  }

  function cambiarCantidad(variantId: string, delta: number) {
    const p = porId.get(variantId);
    setTicket((t) =>
      t
        .map((l) => {
          if (l.variantId !== variantId) return l;
          const qty = Math.min(l.qty + delta, p?.stock ?? l.qty);
          return { ...l, qty };
        })
        .filter((l) => l.qty > 0),
    );
  }

  // El lector de código de barras "teclea" el código y manda Enter.
  function alEscanear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const exacto = products.find((p) => p.barcode === q || p.sku.toLowerCase() === q);
    const elegido = exacto ?? (visibles.length === 1 ? visibles[0] : null);
    if (elegido) {
      agregar(elegido);
      setQuery("");
    } else {
      setAviso(`No encontré un producto con el código "${query.trim()}".`);
    }
  }

  return (
    <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[1fr_388px] lg:grid-rows-[minmax(0,1fr)]">
      {/* ── Catálogo ── */}
      {/* En escritorio solo la grilla hace scroll; buscador y categorías quedan fijos arriba. */}
      <section className="flex flex-col gap-4 p-5 lg:min-h-0">
        <div className="relative">
          <ScanBarcode className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-kora-coral" />
          <input
            ref={buscadorRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={alEscanear}
            placeholder="Escanea el código o busca por nombre o SKU…"
            aria-label="Buscar o escanear producto"
            className="w-full rounded-[14px] border-[1.6px] border-[#e2ddd6] bg-white py-3.5 pr-4 pl-12 text-[15px] outline-none focus:border-kora-coral"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda"
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-[#9aa0ab] hover:text-kora-black">
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {[{ id: null, name: "Todo" } as { id: string | null; name: string }, ...categories].map((c) => (
            <button
              key={c.id ?? "todo"}
              type="button"
              onClick={() => setCategoria(c.id)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                categoria === c.id ? "bg-kora-black text-white" : "bg-white text-[#4a4f58] hover:bg-[#efe9e1]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {aviso && (
          <p className="rounded-[12px] bg-[#FFF4EF] px-4 py-2.5 text-[13px] font-semibold text-kora-coral">{aviso}</p>
        )}

        <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 overflow-y-auto pb-4">
          {visibles.map((p) => {
            const agotado = p.stock <= 0;
            return (
              <button
                key={p.variantId}
                type="button"
                disabled={agotado || !canSell}
                onClick={() => agregar(p)}
                className="flex flex-col overflow-hidden rounded-[14px] bg-white text-left shadow-[0_3px_12px_rgba(0,0,0,0.05)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                {/* Hueco cuadrado FIJO: la foto va en posición absoluta dentro.
                    Si la imagen ocupa el flujo, su alto natural estira el
                    cuadro y cada tarjeta queda de una altura distinta. */}
                <div className="relative flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden bg-[#f5f3f0]">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="absolute inset-0 size-full object-contain p-2" />
                  ) : (
                    <Search className="size-6 text-[#c9c3bb]" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-0.5 p-3">
                  <span className="line-clamp-2 text-[13px] leading-tight font-bold text-kora-black">{p.productName}</span>
                  {p.variantName && <span className="text-[11.5px] text-[#6b6f78]">{p.variantName}</span>}
                  <span className="text-[10.5px] text-[#9aa0ab]">{p.sku}</span>
                  <span className="mt-auto pt-1.5 text-[14px] font-extrabold text-kora-black">{money(p.price)}</span>
                  <span className={`text-[11px] font-semibold ${agotado ? "text-[#9aa0ab]" : p.stock <= 3 ? "text-kora-coral" : "text-[#3c8a5c]"}`}>
                    {agotado ? "Agotado" : `${p.stock} en stock`}
                  </span>
                </div>
              </button>
            );
          })}
          {visibles.length === 0 && (
            <p className="col-span-full py-10 text-center text-[13.5px] text-[#8a8f98]">No hay productos con esa búsqueda.</p>
          )}
        </div>
      </section>

      {/* ── Ticket en curso ── */}
      {/* El ticket tiene su propio scroll: el total y "Cobrar" quedan siempre a la vista. */}
      <aside className="flex flex-col border-l border-[#ece6de] bg-white lg:min-h-0">
        <div className="flex items-center justify-between border-b border-[#f0ece6] px-5 py-4">
          <h2 className="text-[16px] font-bold text-kora-black">
            Ticket en curso {unidades > 0 && <span className="font-semibold text-[#8a8f98]">· {unidades}</span>}
          </h2>
          {lineas.length > 0 && (
            <button type="button" onClick={() => setTicket([])} className="flex items-center gap-1 text-[12.5px] font-semibold text-[#8a8f98] hover:text-destructive">
              <Trash2 className="size-3.5" /> Vaciar
            </button>
          )}
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-[#f3efe9] overflow-y-auto px-5">
          {lineas.map((l) => (
            <li key={l.variantId} className="flex gap-3 py-3">
              {/* La foto, como en el carrito de la tienda: el cajero confirma
                  de un vistazo que escaneó lo que tiene en la mano. */}
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#f7f4f0]">
                {l.p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.p.image} alt="" className="size-full object-contain p-1" />
                ) : (
                  <Search className="size-4 text-[#c9c3bb]" />
                )}
              </span>
              {/* Dos filas: arriba el nombre completo; abajo cantidad y total.
                  En una sola fila, a 388 px el nombre quedaba en "Camiseta …". */}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div>
                  <p className="line-clamp-2 text-[13px] leading-tight font-bold text-kora-black">{l.p.productName}</p>
                  <p className="text-[11.5px] text-[#8a8f98]">
                    {[l.p.variantName, l.p.sku, `${money(l.p.price)} c/u`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => cambiarCantidad(l.variantId, -1)} aria-label="Quitar uno"
                      className="flex size-8 items-center justify-center rounded-full border border-[#e2ddd6] hover:border-kora-coral">
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-6 text-center text-[14px] font-bold">{l.qty}</span>
                    <button type="button" onClick={() => cambiarCantidad(l.variantId, 1)} aria-label="Agregar uno"
                      disabled={l.qty >= l.p.stock}
                      className="flex size-8 items-center justify-center rounded-full border border-[#e2ddd6] hover:border-kora-coral disabled:opacity-40">
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="text-[14px] font-bold">{money(l.p.price * l.qty)}</span>
                </div>
              </div>
            </li>
          ))}
          {lineas.length === 0 && (
            <li className="py-12 text-center text-[13px] text-[#9aa0ab]">Escanea o toca un producto para empezar.</li>
          )}
        </ul>

        <div className="border-t border-[#f0ece6] px-5 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-bold text-kora-black">Total</span>
            <span className="text-[26px] font-extrabold text-kora-black">{money(total)}</span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-[#8a8f98]">Precios con IVA incluido</p>
          <button
            type="button"
            disabled={lineas.length === 0 || !canSell}
            onClick={() => setCobrando(true)}
            className="bg-kora-gradient mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-[16px] font-bold text-white shadow-[0_10px_26px_rgba(255,90,31,0.32)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
          >
            <Banknote className="size-5" /> Cobrar {lineas.length > 0 ? money(total) : ""}
          </button>
          {!canSell && <p className="mt-2 text-center text-[12px] text-[#8a8f98]">Tu usuario puede ver la caja, pero no cobrar.</p>}
        </div>
      </aside>

      {cobrando && (
        <Cobro
          total={total}
          methods={methods}
          lineas={ticket}
          onCerrar={() => setCobrando(false)}
          // La venta ya existe: el ticket se vacía YA, no al cerrar el modal.
          // Si el cajero recarga en el paso "¿imprimir?", no puede volver a
          // cobrar lo mismo. Y el stock de la grilla se relee del servidor.
          onVendido={() => {
            setTicket([]);
            try {
              localStorage.removeItem(TICKET_KEY);
            } catch {}
            router.refresh();
          }}
          onTerminar={() => {
            setCobrando(false);
            buscadorRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/** Cada paso del cobro se ve un momento, como en la pantalla del checkout. */
const MS_POR_ETAPA = 900;

/**
 * Tope del tiquete POS electrónico: 5 UVT SIN impuestos (UVT 2026 = $52.374).
 * Por encima, la venta lleva factura electrónica por ley y el sistema la emite
 * sin preguntar. ⚠️ Supone precios con IVA del 19 % incluido, pendiente de
 * confirmar con el contador de KORA (ver business/iva-y-facturacion-colombia.md).
 */
const TOPE_TIQUETE_POS_SIN_IVA = 5 * 52_374;
const IVA = 0.19;
const DOCUMENTOS_CLIENTE = ["CC", "NIT", "CE", "PP"] as const;

/** Espera hecha promesa, para encadenar las etapas del relato. */
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Imprime el recibo SIN salir de la caja: lo carga en un marco invisible y
 * abre el diálogo de impresión de ese marco. El recibo es la misma página de
 * 80 mm (`/pos/recibo/[id]`), dibujada desde el comprobante congelado.
 */
function imprimirRecibo(orderId: string) {
  const marco = document.createElement("iframe");
  marco.setAttribute("aria-hidden", "true");
  // Ni `display: none` ni `visibility: hidden`: algunos navegadores imprimen
  // en blanco un marco oculto así. Se deja fuera de la vista, con tamaño cero.
  Object.assign(marco.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  marco.src = `/pos/recibo/${orderId}`;
  marco.onload = () => {
    marco.contentWindow?.focus();
    marco.contentWindow?.print();
    // `print()` bloquea hasta cerrar el diálogo en la mayoría de navegadores;
    // el retiro diferido cubre a los que no.
    setTimeout(() => marco.remove(), 60_000);
  };
  document.body.appendChild(marco);
}

function Cobro({
  total: totalTicket,
  methods,
  lineas: lineasTicket,
  onCerrar,
  onVendido,
  onTerminar,
}: {
  total: number;
  methods: string[];
  lineas: Linea[];
  onCerrar: () => void;
  onVendido: () => void;
  onTerminar: () => void;
}) {
  // Se congelan al abrir: al registrarse la venta el ticket de la caja se
  // vacía, y el modal tiene que seguir mostrando lo que se cobró.
  const [total] = useState(totalTicket);
  const [lineas] = useState(lineasTicket);
  const [method, setMethod] = useState(methods[0]);
  const [recibido, setRecibido] = useState("");
  // Cliente: primero el celular (WhatsApp) y "Buscar". Si existe se precarga
  // y la venta se le ata; si no, se llenan los datos y queda creado al cobrar.
  const [cliente, setCliente] = useState<{ id?: string; name: string; document: string; phone: string; email: string }>({
    name: "", document: "", phone: "", email: "",
  });
  const [busqueda, setBusqueda] = useState<"idle" | "buscando" | "encontrado" | "nuevo">("idle");
  async function buscarCliente() {
    if (cliente.phone.replace(/\D/g, "").length < 10) return;
    setBusqueda("buscando");
    const c = await buscarClienteCaja(cliente.phone);
    if (c) {
      setCliente({ id: c.id, name: c.name, document: c.document, phone: c.phone || cliente.phone, email: c.email });
      setBusqueda("encontrado");
    } else {
      setCliente((x) => ({ ...x, id: undefined, name: "", document: "", email: "" }));
      setBusqueda("nuevo");
    }
  }
  // ⚠️ FACTURA ELECTRÓNICA SIMULADA (solo pantalla): todavía no hay proveedor
  // conectado. No se guarda nada ni se envía nada a la DIAN.
  const [factura, setFactura] = useState({ tipo: "CC" as (typeof DOCUMENTOS_CLIENTE)[number], numero: "", nombre: "", correo: "" });
  const [documentoFiscal, setDocumentoFiscal] = useState<{ tipo: "factura" | "tiquete"; numero: string } | null>(null);
  const [conCliente, setConCliente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fase, setFase] = useState<
    "form" | "proceso" | "factura-pregunta" | "factura-datos" | "facturando" | "imprimir"
  >("form");
  const [etapa, setEtapa] = useState(0);
  const [venta, setVenta] = useState<{ orderId: string; orderNumber: string; change: number } | null>(null);
  const siRef = useRef<HTMLButtonElement>(null);

  const efectivo = method === "Efectivo";
  const recibidoNum = Number(recibido.replace(/\D/g, "")) || 0;
  const vueltas = recibidoNum - total;
  const clienteListo =
    !conCliente ||
    ((busqueda === "encontrado" || busqueda === "nuevo") &&
      cliente.name.trim().length >= 3 &&
      cliente.phone.replace(/\D/g, "").length >= 10);
  const puedeCobrar = (!efectivo || recibidoNum >= total) && clienteListo;
  // Por encima del tope, la factura no se pregunta: la ley la exige.
  const facturaObligatoria = total / (1 + IVA) > TOPE_TIQUETE_POS_SIN_IVA;
  // Billetes de un toque: el valor exacto y los redondeos más comunes.
  const sugeridos = [...new Set([total, Math.ceil(total / 10_000) * 10_000, Math.ceil(total / 50_000) * 50_000, Math.ceil(total / 100_000) * 100_000])].slice(0, 4);

  useEffect(() => {
    if (fase === "imprimir") siRef.current?.focus();
  }, [fase]);

  async function cobrar() {
    setError(null);
    setEtapa(0);
    setFase("proceso");
    // El relato avanza por su cuenta y se espera A LAS DOS COSAS —el servidor
    // y las etapas—: el servidor responde en ~300 ms y sin esto la pantalla
    // sería un parpadeo que no deja leer qué pasó.
    const relato = (async () => {
      for (let i = 1; i < pasosCobro(method).length; i++) {
        await pausa(MS_POR_ETAPA);
        setEtapa(i);
      }
      await pausa(MS_POR_ETAPA);
    })();
    const [r] = await Promise.all([
      cobrarVentaPos({
        lines: lineas,
        method,
        cashReceived: efectivo ? recibidoNum : undefined,
        customer: conCliente ? { ...cliente, email: cliente.email.trim() } : undefined,
      }),
      relato,
    ]);
    if (r.ok) {
      setVenta({ orderId: r.orderId, orderNumber: r.orderNumber, change: r.change });
      onVendido();
      if (facturaObligatoria) {
        // Sin preguntar: con los datos que el cajero haya puesto en el cobro,
        // o a "Consumidor final" si no puso ninguno.
        void emitirFactura(
          { tipo: "CC", numero: conCliente ? cliente.document : "", nombre: conCliente ? cliente.name : "", correo: conCliente ? cliente.email : "" },
          r.orderNumber,
        );
      } else {
        setFase("factura-pregunta");
      }
    } else {
      setError(r.error);
      setFase("form");
    }
  }

  /** ⚠️ SIMULADO: anima los pasos y "aprueba". No hay proveedor detrás todavía. */
  // El número de la venta llega por parámetro: justo después de cobrar, el
  // estado `venta` todavía no se ha actualizado en este cierre.
  async function emitirFactura(datos: typeof factura, numeroVenta: string) {
    setFactura(datos);
    setEtapa(0);
    setFase("facturando");
    for (let i = 1; i < PASOS_FACTURA.length; i++) {
      await pausa(MS_POR_ETAPA);
      setEtapa(i);
    }
    await pausa(MS_POR_ETAPA);
    setDocumentoFiscal({ tipo: "factura", numero: `FE-SIM-${numeroVenta.split("-").at(-1)}` });
    setFase("imprimir");
  }

  // ── Registrando la venta: la misma pantalla de proceso del checkout ──
  if (fase === "proceso" || fase === "facturando") {
    const pasos = fase === "proceso" ? pasosCobro(method) : PASOS_FACTURA;
    return (
      <Fondo etiqueta={fase === "proceso" ? "Registrando la venta" : "Generando la factura electrónica"}>
        {fase === "facturando" && <Simulacion />}
        <ProcesoCobro pasos={pasos} paso={etapa} listo={false} />
        <p className="mt-6 text-center text-[12.5px] text-muted-foreground">{money(total)} · No cierres esta ventana</p>
      </Fondo>
    );
  }

  const encabezadoVenta = venta && (
    <div className="text-center">
      <p className="text-[20px] font-extrabold text-kora-black">¡Venta registrada!</p>
      <p className="mt-1 text-[13px] text-[#8a8f98]">N.º {venta.orderNumber} · {money(total)} · {method}</p>
      {efectivo && (
        <p className="mx-auto mt-3 w-fit rounded-[14px] bg-[#FFF4EF] px-5 py-2.5 text-[15px] font-bold text-kora-black">
          Vueltas: <span className="text-kora-coral">{money(venta.change)}</span>
        </p>
      )}
    </div>
  );

  // ── ¿Factura electrónica? (solo por debajo del tope) ──
  if (fase === "factura-pregunta" && venta) {
    return (
      <Fondo etiqueta="Factura electrónica">
        <Simulacion />
        <ProcesoCobro pasos={pasosCobro(method)} paso={2} listo />
        <div className="mt-4">{encabezadoVenta}</div>
        <p className="mt-6 text-center text-[16px] font-bold text-kora-black">¿El cliente quiere factura electrónica?</p>
        <p className="mt-1 text-center text-[12.5px] text-[#8a8f98]">Si no, la venta sale con tiquete POS electrónico.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button"
            onClick={() => {
              setDocumentoFiscal({ tipo: "tiquete", numero: `POS-SIM-${venta.orderNumber.split("-").at(-1)}` });
              setFase("imprimir");
            }}
            className="rounded-full border-[1.6px] border-[#e2ddd6] px-5 py-3.5 text-[15px] font-bold text-kora-black hover:border-kora-coral">
            No
          </button>
          <button type="button"
            onClick={() => {
              setFactura((f) => ({ ...f, numero: conCliente ? cliente.document : f.numero, nombre: conCliente ? cliente.name : f.nombre, correo: conCliente ? cliente.email : f.correo }));
              setFase("factura-datos");
            }}
            className="bg-kora-gradient flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[15px] font-bold text-white hover:opacity-90">
            <FileText className="size-4" /> Sí, facturar
          </button>
        </div>
      </Fondo>
    );
  }

  // ── Datos de la factura ──
  if (fase === "factura-datos" && venta) {
    const completa = factura.numero.trim().length >= 5 && factura.nombre.trim().length >= 3 && /\S+@\S+\.\S+/.test(factura.correo);
    const campo = "rounded-[11px] border-[1.6px] border-[#e2ddd6] px-3.5 py-2.5 text-[14px] outline-none focus:border-kora-coral";
    return (
      <Fondo etiqueta="Datos de la factura electrónica">
        <Simulacion />
        <h2 className="text-[18px] font-bold text-kora-black">Datos para la factura</h2>
        <p className="mt-1 text-[12.5px] text-[#8a8f98]">La factura llega al correo del cliente.</p>
        <div className="mt-4 grid gap-2.5">
          <div className="grid grid-cols-[96px_1fr] gap-2">
            <select aria-label="Tipo de documento" value={factura.tipo}
              onChange={(e) => setFactura((f) => ({ ...f, tipo: e.target.value as typeof f.tipo }))} className={campo}>
              {DOCUMENTOS_CLIENTE.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <input aria-label="Número de documento" placeholder={factura.tipo === "NIT" ? "NIT con dígito de verificación" : "Número de documento"}
              inputMode="numeric" autoFocus value={factura.numero}
              onChange={(e) => setFactura((f) => ({ ...f, numero: e.target.value }))} className={campo} />
          </div>
          <input aria-label="Nombre o razón social" placeholder={factura.tipo === "NIT" ? "Razón social" : "Nombre completo"}
            value={factura.nombre} onChange={(e) => setFactura((f) => ({ ...f, nombre: e.target.value }))} className={campo} />
          <input aria-label="Correo" type="email" placeholder="Correo para enviar la factura"
            value={factura.correo} onChange={(e) => setFactura((f) => ({ ...f, correo: e.target.value }))} className={campo} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setFase("factura-pregunta")}
            className="rounded-full border-[1.6px] border-[#e2ddd6] px-5 py-3.5 text-[15px] font-bold text-kora-black hover:border-kora-coral">
            Volver
          </button>
          <button type="button" disabled={!completa} onClick={() => void emitirFactura(factura, venta.orderNumber)}
            className="bg-kora-gradient rounded-full px-5 py-3.5 text-[15px] font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">
            Generar factura
          </button>
        </div>
      </Fondo>
    );
  }

  // ── Listo: ¿imprimir? ──
  if (fase === "imprimir" && venta) {
    const terminar = (imprimir: boolean) => {
      if (imprimir) imprimirRecibo(venta.orderId);
      onTerminar();
    };
    const fiscal = documentoFiscal;
    return (
      <Fondo etiqueta="Venta registrada">
        <div onKeyDown={(e) => { if (e.key === "Escape") terminar(false); }}>
          <ProcesoCobro pasos={fiscal?.tipo === "factura" ? PASOS_FACTURA : pasosCobro(method)} paso={2} listo />
          <div className="mt-4">{encabezadoVenta}</div>
          {fiscal && (
            <div className="mt-4 rounded-[14px] border border-[#e7f4ec] bg-[#f5fbf7] px-4 py-3 text-center text-[13px]">
              <p className="font-bold text-[#2f7d4f]">
                {fiscal.tipo === "factura" ? "Factura electrónica generada" : "Tiquete POS electrónico generado"} · {fiscal.numero}
              </p>
              {fiscal.tipo === "factura" && (
                <p className="mt-0.5 text-[#4a4f58]">
                  {factura.nombre.trim() || "Consumidor final"}
                  {factura.correo ? ` · enviada a ${factura.correo}` : ""}
                </p>
              )}
              {facturaObligatoria && fiscal.tipo === "factura" && (
                <p className="mt-0.5 text-[11.5px] text-[#8a8f98]">Automática: la venta supera el tope del tiquete POS (5 UVT).</p>
              )}
              <p className="mt-1 text-[11px] font-semibold text-kora-coral">Simulación · todavía sin conexión con la DIAN</p>
            </div>
          )}
          <p className="mt-6 text-center text-[16px] font-bold text-kora-black">¿Deseas imprimir el ticket?</p>
          <div className="mt-4 grid w-full grid-cols-2 gap-3">
            <button type="button" onClick={() => terminar(false)}
              className="rounded-full border-[1.6px] border-[#e2ddd6] px-5 py-3.5 text-[15px] font-bold text-kora-black hover:border-kora-coral">
              No
            </button>
            <button ref={siRef} type="button" onClick={() => terminar(true)}
              className="bg-kora-gradient flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[15px] font-bold text-white hover:opacity-90">
              <Printer className="size-4" /> Sí, imprimir
            </button>
          </div>
        </div>
      </Fondo>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Cobrar">
      {/* Horizontal: a la izquierda el dinero (total, método, recibido y
          vueltas), a la derecha el cliente y el botón. En vertical, con los
          datos del cliente abiertos, el modal ya no cabía en la pantalla. En
          pantallas angostas vuelve a una columna, con scroll propio. */}
      <div className="grid max-h-[92dvh] w-full max-w-[920px] grid-cols-1 gap-6 overflow-y-auto rounded-[22px] bg-white p-6 shadow-xl md:grid-cols-2 md:p-7">
        <div className="min-w-0">
        {/* El total a cobrar es lo primero que se lee: grande y en marca. */}
        <div className="bg-kora-gradient relative mb-5 rounded-[18px] px-5 py-4 text-white shadow-[0_14px_30px_-14px_rgba(255,90,31,0.7)]">
          <p className="text-[12px] font-bold tracking-[1.5px] uppercase opacity-85">Total a cobrar</p>
          <p className="mt-0.5 text-[34px] leading-tight font-extrabold">{money(total)}</p>
          <button type="button" onClick={onCerrar} aria-label="Cerrar"
            className="absolute top-3 right-3 rounded-full bg-white/15 p-1.5 text-white hover:bg-white/25">
            <X className="size-4" />
          </button>
        </div>

        <p className="mb-2 text-[12.5px] font-semibold text-[#6b6f78]">Método de pago</p>
        <div className="grid grid-cols-3 gap-2">
          {methods.map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)}
              className={`rounded-[12px] border-[1.8px] px-4 py-3 text-[14px] font-semibold ${
                method === m ? "border-kora-coral bg-[#FFF4EF] text-kora-black" : "border-[#e2ddd6] text-[#4a4f58]"
              }`}>
              {m}
            </button>
          ))}
        </div>

        {efectivo && (
          <div className="mt-4">
            <label htmlFor="recibido" className="mb-1.5 block text-[12.5px] font-semibold text-[#6b6f78]">Recibido</label>
            {/* Se escribe en pesos, con separador de miles mientras se teclea:
                "130000" plano se lee mal con el cliente esperando. El estado
                guarda solo dígitos; el punto es presentación. */}
            <div className="flex items-center rounded-[11px] border-[1.6px] border-[#e2ddd6] px-4 focus-within:border-kora-coral">
              <span className="text-[20px] font-bold text-[#9aa0ab]">$</span>
              <input id="recibido" inputMode="numeric" autoFocus autoComplete="off"
                value={recibido ? Number(recibido).toLocaleString("es-CO") : ""}
                onChange={(e) => setRecibido(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9))}
                placeholder={total.toLocaleString("es-CO")}
                className="w-full bg-transparent py-3 pl-1.5 text-[22px] font-extrabold tracking-tight outline-none placeholder:font-bold placeholder:text-[#c9c3bb]" />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {sugeridos.map((v) => (
                <button key={v} type="button" onClick={() => setRecibido(String(v))}
                  className="rounded-full bg-[#f5f3f0] px-3 py-1.5 text-[12.5px] font-semibold hover:bg-[#efe9e1]">
                  {money(v)}
                </button>
              ))}
            </div>
            {/* Las vueltas son lo que el cajero tiene que leer de un vistazo,
                con el cliente esperando: grandes y en su propio recuadro. */}
            {recibidoNum === 0 ? (
              <p className="mt-3 text-[13.5px] font-semibold text-[#8a8f98]">Escribe cuánto recibes</p>
            ) : vueltas < 0 ? (
              <div className="mt-3 flex items-center justify-between rounded-[16px] bg-[#fdecec] px-5 py-3.5">
                <span className="text-[14px] font-bold text-destructive">Faltan</span>
                <span className="text-[26px] font-extrabold text-destructive">{money(-vueltas)}</span>
              </div>
            ) : (
              <div className="bg-kora-gradient mt-3 flex items-center justify-between rounded-[16px] px-5 py-3.5 text-white shadow-[0_10px_24px_-10px_rgba(255,90,31,0.6)]">
                <span className="text-[14px] font-bold tracking-wide uppercase">Vueltas</span>
                <span key={vueltas} className="pos-vueltas text-[30px] leading-none font-extrabold">{money(vueltas)}</span>
              </div>
            )}
            <style>{`
              @keyframes posVueltas { from { opacity: .4; transform: scale(.94); } to { opacity: 1; transform: none; } }
              .pos-vueltas { animation: posVueltas 260ms cubic-bezier(0.22, 1, 0.36, 1); }
              @media (prefers-reduced-motion: reduce) { .pos-vueltas { animation: none; } }
            `}</style>
          </div>
        )}

        </div>

        <div className="flex min-w-0 flex-col md:border-l md:border-[#f0ece6] md:pl-6">
        <p className="mb-3 text-[12.5px] font-semibold text-[#6b6f78]">Cliente</p>
        <Switch checked={conCliente} onCheckedChange={setConCliente} label="Agregar datos del cliente (opcional)" />
        {!conCliente && (
          <p className="mt-2 text-[12.5px] text-[#9aa0ab]">Sin datos, el recibo sale a «Consumidor final».</p>
        )}
        {conCliente && (
          <div className="mt-3 grid gap-2">
            {/* Paso 1: el celular y "Buscar". */}
            <div className="flex gap-2">
              <div className="flex flex-1 items-center rounded-[11px] border-[1.6px] border-[#e2ddd6] px-3.5 focus-within:border-kora-coral">
                <span className="text-[14px] font-semibold text-[#9aa0ab]">+57</span>
                <input aria-label="Celular (WhatsApp) del cliente" placeholder="Celular (WhatsApp)" inputMode="tel" autoFocus
                  value={cliente.phone}
                  onChange={(e) => {
                    setCliente((c) => ({ ...c, id: undefined, phone: e.target.value.replace(/[^\d ]/g, "") }));
                    setBusqueda("idle");
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void buscarCliente(); } }}
                  className="w-full bg-transparent py-2.5 pl-2 text-[14px] outline-none" />
              </div>
              <button type="button" onClick={() => void buscarCliente()}
                disabled={cliente.phone.replace(/\D/g, "").length < 10 || busqueda === "buscando"}
                className="flex items-center gap-1.5 rounded-[11px] bg-kora-black px-4 text-[13.5px] font-bold text-white disabled:opacity-40">
                <Search className="size-4" /> {busqueda === "buscando" ? "Buscando…" : "Buscar"}
              </button>
            </div>
            {busqueda === "encontrado" && (
              <p className="rounded-[10px] bg-[#e7f4ec] px-3 py-2 text-[12.5px] font-semibold text-[#2f7d4f]">
                ✓ ¡Cliente encontrado!
              </p>
            )}
            {busqueda === "nuevo" && (
              <p className="rounded-[10px] bg-[#FFF4EF] px-3 py-2 text-[12.5px] font-semibold text-kora-coral">
                ¡Cliente nuevo!
              </p>
            )}
            {/* Paso 2: los datos, precargados o por llenar. */}
            {(busqueda === "encontrado" || busqueda === "nuevo") && (
              <>
                <input aria-label="Nombre del cliente" placeholder="Nombre completo" value={cliente.name}
                  onChange={(e) => setCliente((c) => ({ ...c, name: e.target.value }))}
                  className="rounded-[11px] border-[1.6px] border-[#e2ddd6] px-3.5 py-2.5 text-[14px] outline-none focus:border-kora-coral" />
                <div className="grid grid-cols-2 gap-2">
                  <input aria-label="Cédula del cliente" placeholder="Cédula (opcional)" inputMode="numeric" value={cliente.document}
                    onChange={(e) => setCliente((c) => ({ ...c, document: e.target.value }))}
                    className="rounded-[11px] border-[1.6px] border-[#e2ddd6] px-3.5 py-2.5 text-[14px] outline-none focus:border-kora-coral" />
                  <input aria-label="Correo del cliente" placeholder="Correo (opcional)" type="email" value={cliente.email}
                    onChange={(e) => setCliente((c) => ({ ...c, email: e.target.value }))}
                    className="rounded-[11px] border-[1.6px] border-[#e2ddd6] px-3.5 py-2.5 text-[14px] outline-none focus:border-kora-coral" />
                </div>
              </>
            )}
          </div>
        )}

        {facturaObligatoria && (
          <p className="mt-4 rounded-[12px] bg-[#FFF4EF] px-3.5 py-2.5 text-[12.5px] text-[#4a4f58]">
            <b className="text-kora-black">Esta venta lleva factura electrónica:</b> supera el tope del tiquete POS (5 UVT, {money(TOPE_TIQUETE_POS_SIN_IVA)} sin IVA). Se genera sola al cobrar; si agregas los datos del cliente, sale a su nombre.
          </p>
        )}
        {error && <p className="mt-4 rounded-[10px] bg-[#fdecec] px-3 py-2 text-[13px] font-semibold text-destructive">{error}</p>}

        {/* El botón va al fondo de la columna, alineado con el final del dinero. */}
        <div className="mt-auto pt-5">
          <button type="button" disabled={!puedeCobrar} onClick={cobrar}
            className="bg-kora-gradient flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-[16px] font-bold text-white shadow-[0_12px_28px_-12px_rgba(255,90,31,0.7)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none">
            Confirmar cobro · {money(total)}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

/** El fondo y la tarjeta de los pasos del cobro (sin botón de cerrar: no se interrumpe). */
function Fondo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={etiqueta}>
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-[22px] bg-white p-7 shadow-xl">{children}</div>
    </div>
  );
}

/** Marca visible de lo que todavía es de mentira: nadie debe creer que ya se facturó. */
function Simulacion() {
  return (
    <p className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-[#fff4e5] px-3 py-1 text-[11px] font-bold tracking-wide text-[#b45309] uppercase">
      <FlaskConical className="size-3.5" /> Simulación de facturación
    </p>
  );
}
