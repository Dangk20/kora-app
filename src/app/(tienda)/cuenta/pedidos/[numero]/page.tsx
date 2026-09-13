import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, Home, MessageCircle } from "lucide-react";
import { CONFIRMED_STATUSES } from "@/modules/customers/confirmed";
import { requireBuyer } from "@/modules/buyer/guard";
import { buyerOrder } from "@/modules/buyer/orders";
import { formatOrderNumber, variantDetails, whatsappUrl } from "@/modules/orders/message";
import { whatsappNumberFor } from "@/modules/orders/settings";
import { PASOS_PEDIDO, fraseDeEstado, money } from "../../ui";

export const metadata = { title: "Detalle del pedido · KORA" };

const fechaLarga = (d: Date) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(d);
const fechaHora = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(d);

/**
 * El detalle de un pedido, como una compra en Mercado Libre pero con lo que
 * KORA tiene: en qué va (titular + línea de tiempo con fechas reales), qué
 * se compró (con foto), a dónde va, el comprobante, y el resumen del pago.
 * Sin "mensajes al vendedor" ni "cancelar": el contacto es WhatsApp y ya está.
 */
export default async function PedidoPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  const buyer = await requireBuyer(`/cuenta/pedidos/${numero}`);
  const n = Number(numero);
  if (!Number.isInteger(n)) notFound();

  // El comprador va en la consulta, no en una comprobación posterior.
  const pedido = await buyerOrder(buyer.customerId, n);
  if (!pedido) notFound();

  const whatsapp =
    pedido.vigente && pedido.whatsappMessage
      ? whatsappUrl(await whatsappNumberFor(pedido.currency), pedido.whatsappMessage)
      : null;

  const cancelado = pedido.status === "CANCELLED";
  const pasoActual = PASOS_PEDIDO.findIndex((p) => p.status === pedido.status);
  const estado = fraseDeEstado(pedido.status, pedido.estadoEn[pedido.status] ?? pedido.createdAt);
  const tieneComprobante = CONFIRMED_STATUSES.includes(pedido.status);

  const direccion = [
    [pedido.shipAddress, pedido.shipAddress2].filter(Boolean).join(", "),
    pedido.shipNeighborhood,
    [pedido.shipCity, pedido.shipState].filter(Boolean).join(", "),
  ].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-5 sm:py-10">
      <nav className="mb-4 flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/cuenta" className="inline-flex items-center gap-1 hover:text-kora-black">
          <ArrowLeft className="size-4" /> Mis pedidos
        </Link>
        <span>›</span>
        <span className="text-kora-black">{formatOrderNumber(pedido.number, pedido.createdAt)}</span>
      </nav>

      {/* `min-w-0` en la rejilla y en la columna: sin él, la fila de un
          producto (foto + nombre + precio) estira la columna y la página se
          desplaza de lado en móvil (410 px en una de 390, medido). */}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ══════════ Izquierda ══════════ */}
        <div className="min-w-0 space-y-4">
          {/* En qué va */}
          <section className="rounded-[16px] border border-[#eee9e2] bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={`text-[13px] font-semibold ${estado.tono}`}>{estado.corta}</p>
                <h1 className="mt-1 text-[22px] leading-tight font-extrabold text-kora-black text-balance sm:text-[26px]">
                  {estado.titulo}
                </h1>
                {estado.detalle && <p className="mt-1.5 text-[13.5px] text-muted-foreground">{estado.detalle}</p>}
              </div>
              {pedido.items[0]?.imageUrl && (
                <div className="relative size-[72px] shrink-0 overflow-hidden rounded-[10px] border border-[#eee9e2] bg-[#f7f4f0] sm:size-[88px]">
                  <Image src={pedido.items[0].imageUrl} alt="" fill sizes="88px" className="object-contain p-1" unoptimized />
                </div>
              )}
            </div>

            {/* La línea de tiempo: horizontal en móvil, vertical con fechas en escritorio. */}
            {!cancelado && (
              <>
                {/* Móvil: barra horizontal. Cada paso lleva su icono; el actual,
                    más grande y con halo. La etiqueta del paso actual va debajo
                    de la barra porque cinco etiquetas no caben en 390 px. */}
                <ol className="mt-6 flex items-center sm:hidden" aria-label="Progreso del pedido">
                  {PASOS_PEDIDO.map((p, i) => {
                    const hecho = i <= pasoActual;
                    const actual = i === pasoActual;
                    return (
                      <li key={p.status} className="flex flex-1 items-center last:flex-none">
                        <span
                          aria-label={p.label}
                          aria-current={actual ? "step" : undefined}
                          className={`flex shrink-0 items-center justify-center rounded-full ${
                            actual
                              ? "size-10 bg-kora-black text-white ring-4 ring-[#f0ece6]"
                              : hecho
                                ? "size-7 bg-kora-black text-white"
                                : "size-7 border-2 border-[#d9d4cc] bg-white text-[#b3b8c0]"
                          }`}
                        >
                          <p.Icono className={actual ? "size-[18px]" : "size-3.5"} />
                        </span>
                        {i < PASOS_PEDIDO.length - 1 && <span className={`h-[3px] flex-1 ${i < pasoActual ? "bg-kora-black" : "bg-[#e6e1da]"}`} />}
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-2 text-[12px] text-muted-foreground sm:hidden">
                  {PASOS_PEDIDO[pasoActual]?.label}
                  {pasoActual < PASOS_PEDIDO.length - 1 && ` · siguiente: ${PASOS_PEDIDO[pasoActual + 1].label.toLowerCase()}`}
                </p>
                <ol className="mt-6 hidden sm:block">
                  {PASOS_PEDIDO.map((p, i) => {
                    const hecho = i <= pasoActual;
                    const actual = i === pasoActual;
                    const cuando = pedido.estadoEn[p.status] ?? (p.status === "PENDING" ? pedido.createdAt : null);
                    return (
                      <li key={p.status} className="relative flex gap-4 pb-6 last:pb-0">
                        {i < PASOS_PEDIDO.length - 1 && (
                          <span className={`absolute top-9 left-[17px] h-[calc(100%-1.25rem)] w-[2px] ${i < pasoActual ? "bg-kora-black" : "bg-[#d9d4cc]"}`} aria-hidden />
                        )}
                        <span
                          aria-current={actual ? "step" : undefined}
                          className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ${
                            actual
                              ? "bg-kora-black text-white ring-4 ring-[#f0ece6]"
                              : hecho
                                ? "bg-kora-black text-white"
                                : "border-2 border-[#d9d4cc] bg-white text-[#b3b8c0]"
                          }`}
                        >
                          <p.Icono className="size-4" />
                        </span>
                        <div className="pt-1.5">
                          <p className={`text-[14px] font-semibold ${hecho ? "text-kora-black" : "text-[#b3b8c0]"}`}>{p.label}</p>
                          {hecho && cuando && <p className="text-[12px] text-muted-foreground">{fechaHora(cuando)}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}

            {pedido.status === "PENDING" && (
              <div className="mt-5 rounded-[12px] border border-[#ffd9c7] bg-[#FFF4EF] px-4 py-3.5">
                {whatsapp ? (
                  <>
                    <p className="text-[13.5px] text-kora-black">
                      Tu pedido está reservado. Retoma la conversación para confirmar el pago.
                    </p>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer"
                      className="bg-kora-gradient mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-white">
                      <MessageCircle className="size-4" /> Continuar por WhatsApp
                    </a>
                  </>
                ) : (
                  <p className="text-[13.5px] text-kora-black">
                    Este pedido superó su vigencia sin confirmarse. Si todavía lo quieres, vuelve a armarlo desde el catálogo.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Qué se compró */}
          <section className="rounded-[16px] border border-[#eee9e2] bg-white">
            <h2 className="border-b border-[#f0ece6] px-5 py-3.5 text-[15px] font-bold text-kora-black">Productos</h2>
            <ul>
              {pedido.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 border-b border-[#f0ece6] px-5 py-3.5 last:border-0">
                  <Link href={`/producto/${i.slug}`} className="relative size-14 shrink-0 overflow-hidden rounded-[10px] border border-[#eee9e2] bg-[#f7f4f0]">
                    {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="56px" className="object-contain p-1" unoptimized />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/producto/${i.slug}`} className="block truncate text-[14px] font-semibold text-kora-black hover:text-kora-coral">
                      {i.productName}
                    </Link>
                    <p className="text-[12.5px] text-muted-foreground">
                      {i.qty} u.
                      {variantDetails(i.variantName).length > 0 && ` · ${variantDetails(i.variantName).join(", ")}`}
                      {" · "}{money(i.unitPrice, pedido.currency)} c/u
                    </p>
                  </div>
                  <span className="shrink-0 text-[14px] font-bold text-kora-black">{money(i.total, pedido.currency)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* A dónde va */}
          {direccion.length > 0 && (
            <section className="rounded-[16px] border border-[#eee9e2] bg-white">
              <h2 className="border-b border-[#f0ece6] px-5 py-3.5 text-[15px] font-bold text-kora-black">Entrega</h2>
              <div className="flex items-start gap-4 px-5 py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#eee9e2] text-kora-black">
                  <Home className="size-[18px]" />
                </span>
                <div className="text-[13.5px]">
                  <p className="font-semibold text-kora-black">{direccion[0]}</p>
                  {direccion.slice(1).map((l) => <p key={l} className="text-muted-foreground">{l}</p>)}
                  {pedido.shipNotes && <p className="mt-1 text-[12.5px] text-muted-foreground">Indicaciones: {pedido.shipNotes}</p>}
                  <p className="mt-2 text-[12px] text-muted-foreground">El envío se coordina contigo por WhatsApp al confirmar.</p>
                </div>
              </div>
            </section>
          )}

          {/* Comprobante */}
          <section className="rounded-[16px] border border-[#eee9e2] bg-white">
            <h2 className="border-b border-[#f0ece6] px-5 py-3.5 text-[15px] font-bold text-kora-black">Información de la compra</h2>
            {tieneComprobante ? (
              <a href={`/cuenta/pedidos/${pedido.number}/comprobante?descargar`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#faf8f5]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FFE9DD] text-kora-coral">
                  <FileText className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-kora-black">Comprobante de pedido</span>
                  <span className="block text-[12.5px] text-muted-foreground">El mismo que te enviamos por correo al confirmar</span>
                </span>
                <Download className="size-[18px] text-muted-foreground" />
              </a>
            ) : (
              <div className="flex items-center gap-4 px-5 py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#eee9e2] text-[#b3b8c0]">
                  <FileText className="size-[18px]" />
                </span>
                <span className="text-[13.5px] text-muted-foreground">
                  {cancelado ? "Un pedido cancelado no genera comprobante." : "El comprobante se genera al confirmar el pago."}
                </span>
              </div>
            )}
          </section>
        </div>

        {/* ══════════ Derecha: el resumen ══════════ */}
        <aside className="rounded-[16px] border border-[#eee9e2] bg-white p-5 lg:sticky lg:top-24">
          <h2 className="text-[16px] font-bold text-kora-black">Detalle de la compra</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {fechaLarga(pedido.createdAt)} · {formatOrderNumber(pedido.number, pedido.createdAt)}
          </p>
          <dl className="mt-4 space-y-2 border-t border-[#f0ece6] pt-4 text-[13.5px]">
            <Fila label={`Producto${pedido.items.length === 1 ? "" : "s"}`} valor={money(pedido.subtotal, pedido.currency)} />
            {pedido.discountTotal > 0 && <Fila label="Descuento" valor={`− ${money(pedido.discountTotal, pedido.currency)}`} />}
            {pedido.cashbackApplied > 0 && <Fila label="Kora Cashback" valor={`− ${money(pedido.cashbackApplied, pedido.currency)}`} />}
            <Fila label="Envío" valor="Por WhatsApp" suave />
          </dl>
          <div className="mt-3 flex items-baseline justify-between border-t border-[#f0ece6] pt-3">
            <span className="text-[15px] font-bold text-kora-black">Total</span>
            <span className="text-[20px] font-extrabold text-kora-black">{money(pedido.total, pedido.currency)}</span>
          </div>

          {pedido.cashback > 0 && (
            <p className="mt-4 rounded-[12px] bg-[#FFF4EF] px-4 py-3 text-[12.5px] leading-relaxed text-[#6b6f78]">
              {pedido.cashbackAcreditado ? (
                <>Te dio <strong className="text-kora-black">{money(pedido.cashback, pedido.currency)}</strong> de Kora Cashback
                  {pedido.cashbackVence && <>, disponible hasta el {fechaLarga(pedido.cashbackVence)}</>}.</>
              ) : pedido.cashbackEstado === "estimado" ? (
                <>Al confirmarse te dará <strong className="text-kora-black">~{money(pedido.cashback, pedido.currency)}</strong> de Kora Cashback.</>
              ) : null}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

function Fila({ label, valor, suave }: { label: string; valor: string; suave?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={suave ? "text-muted-foreground" : "text-kora-black"}>{valor}</dd>
    </div>
  );
}
