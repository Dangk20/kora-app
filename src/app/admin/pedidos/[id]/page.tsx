import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/modules/pricing";
import { formatOrderNumber } from "@/modules/orders/message";
import {
  formatTimeLeft,
  minutesLeft,
  STATUS_LABEL,
  STATUS_STYLE,
} from "@/modules/orders/status";
import { OrderActions } from "./order-actions";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("orders:view")) redirect("/admin");
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: { variant: { select: { stockActual: true, onlineUnits: true } } },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true } } },
      },
      confirmedBy: { select: { name: true } },
    },
  });
  if (!order) notFound();

  const perms = session.user.permissions;
  const style = STATUS_STYLE[order.status];
  const left = order.status === "PENDING" ? minutesLeft(order.expiresAt) : null;
  const number = formatOrderNumber(order.number, order.createdAt);

  // Stock por ítem: la mitigación de vender sin reserva es que el operador
  // vea, antes de confirmar, si la mercancía todavía está.
  const shortages = order.items.filter((i) => i.variant.stockActual < i.qty);

  const chatHref = order.contactPhone
    ? `https://api.whatsapp.com/send?phone=${order.contactPhone.replace(/\D/g, "")}`
    : null;

  const address = [
    order.shipAddress,
    order.shipAddress2,
    order.shipNeighborhood ? `Barrio ${order.shipNeighborhood}` : null,
    order.shipCity,
    order.shipState,
    order.shipZip,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-5">
      <Link
        href="/admin/pedidos"
        className="inline-flex items-center gap-1.5 text-[13px] text-[#8a8f98] hover:text-kora-black"
      >
        <ArrowLeft className="size-4" /> Volver a pedidos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-[18px] bg-white p-6 shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-kora-black">{number}</h1>
            <span
              className="rounded-full px-3 py-1 text-[12px] font-bold"
              style={{ background: style.bg, color: style.color }}
            >
              {STATUS_LABEL[order.status]}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-[#8a8f98]">
            {order.createdAt.toLocaleString("es-CO", {
              dateStyle: "long",
              timeStyle: "short",
            })}
            {" · "}
            {order.currency === "COP" ? "Colombia" : "EE.UU."} · Tienda online
          </p>
          {order.status === "PENDING" && (
            <p
              className="mt-1 text-[13px] font-semibold"
              style={{ color: left !== null && left <= 0 ? "#E5484D" : "#FF5A1F" }}
            >
              {left !== null && left <= 0
                ? "Vigencia vencida — se cancelará automáticamente"
                : `Expira en ${formatTimeLeft(left)}`}
            </p>
          )}
          {order.confirmedAt && (
            <p className="mt-1 text-[12.5px] text-[#8a8f98]">
              Confirmado por {order.confirmedBy?.name ?? "—"} el{" "}
              {order.confirmedAt.toLocaleString("es-CO", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {chatHref && (
            <a
              href={chatHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-kora-black hover:border-kora-coral"
            >
              <MessageCircle className="size-4" /> Abrir chat
            </a>
          )}
          <OrderActions
            orderId={order.id}
            status={order.status}
            canConfirm={perms.includes("orders:confirm")}
            canCancel={perms.includes("orders:cancel")}
            canEdit={perms.includes("orders:edit")}
            hasShortages={shortages.length > 0}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {/* Ítems con su stock actual */}
          <section className="overflow-hidden rounded-[18px] bg-white shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
            <h2 className="border-b border-[#f0ece6] px-6 py-4 text-[15px] font-bold text-kora-black">
              Productos del pedido
            </h2>
            {order.items.map((item) => {
              const short = item.variant.stockActual < item.qty;
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[2.5fr_0.7fr_1fr_1fr] items-center gap-3 border-b border-[#f7f4f0] px-6 py-3.5 text-[13px] last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-kora-black">
                      {item.productName}
                    </p>
                    <p className="text-[11.5px] text-[#9aa0ab]">
                      {item.variantName} · SKU {item.sku}
                    </p>
                  </div>
                  <span className="font-bold text-kora-black">×{item.qty}</span>
                  <span
                    className="text-[12.5px] font-semibold"
                    style={{ color: short ? "#E5484D" : "#8a8f98" }}
                    title="Stock disponible ahora mismo"
                  >
                    Stock: {item.variant.stockActual}
                    {short && " ⚠️"}
                  </span>
                  <span className="text-right font-bold text-kora-black">
                    {formatMoney(Number(item.total), order.currency)}
                  </span>
                </div>
              );
            })}

            <div className="flex items-center justify-between px-6 py-4">
              <span className="text-[15px] font-bold text-kora-black">Total</span>
              <span className="text-xl font-extrabold text-kora-black">
                {formatMoney(Number(order.total), order.currency)} {order.currency}
              </span>
            </div>

            {shortages.length > 0 && order.status === "PENDING" && (
              <div className="border-t border-[#f0ece6] bg-[#fce8e8] px-6 py-4">
                <p className="text-[13px] font-bold text-[#E5484D]">
                  No hay stock suficiente para confirmar
                </p>
                <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-[#16181D]">
                  {shortages.map((s) => (
                    <li key={s.id}>
                      {s.productName} ({s.sku}): se piden {s.qty} y hay{" "}
                      {s.variant.stockActual}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] text-[#6b6f78]">
                  Resuélvelo con el comprador o ajusta el inventario antes de confirmar.
                </p>
              </div>
            )}
          </section>

          {/* Historial */}
          <section className="rounded-[18px] bg-white p-6 shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
            <h2 className="mb-4 text-[15px] font-bold text-kora-black">
              Historial del pedido
            </h2>
            <ol className="space-y-3">
              {order.statusHistory.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ background: STATUS_STYLE[h.to].color }}
                  />
                  <div className="text-[13px]">
                    <p className="font-semibold text-kora-black">
                      {h.from === h.to
                        ? STATUS_LABEL[h.to]
                        : `${STATUS_LABEL[h.from]} → ${STATUS_LABEL[h.to]}`}
                    </p>
                    <p className="text-[11.5px] text-[#9aa0ab]">
                      {h.createdAt.toLocaleString("es-CO", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {h.actor?.name ?? "Sistema"}
                    </p>
                    {h.note && (
                      <p className="mt-0.5 text-[12.5px] text-[#4a4f58]">{h.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Datos del comprador */}
        <div className="space-y-5">
          <section className="rounded-[18px] bg-white p-6 shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
            <h2 className="mb-4 text-[15px] font-bold text-kora-black">Comprador</h2>
            <dl className="space-y-3 text-[13px]">
              {[
                ["Nombre", order.contactName],
                ["Teléfono", order.contactPhone],
                ["Correo", order.contactEmail],
                ["Documento", order.contactDocument],
              ]
                .filter(([, v]) => Boolean(v))
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11.5px] text-[#9aa0ab]">{label}</dt>
                    <dd className="font-medium break-words text-kora-black">{value}</dd>
                  </div>
                ))}
            </dl>
          </section>

          <section className="rounded-[18px] bg-white p-6 shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
            <h2 className="mb-4 text-[15px] font-bold text-kora-black">Entrega y pago</h2>
            <dl className="space-y-3 text-[13px]">
              <div>
                <dt className="text-[11.5px] text-[#9aa0ab]">Dirección</dt>
                <dd className="font-medium text-kora-black">{address || "—"}</dd>
              </div>
              {order.shipNotes && (
                <div>
                  <dt className="text-[11.5px] text-[#9aa0ab]">Notas de entrega</dt>
                  <dd className="font-medium text-kora-black">{order.shipNotes}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11.5px] text-[#9aa0ab]">Pago preferido</dt>
                <dd className="font-medium text-kora-black">
                  {order.paymentPreference ?? "—"}
                </dd>
              </div>
            </dl>
          </section>

          {order.whatsappMessage && (
            <section className="rounded-[18px] bg-white p-6 shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
              <h2 className="mb-3 text-[15px] font-bold text-kora-black">
                Mensaje enviado por el comprador
              </h2>
              <pre className="rounded-[11px] bg-[#faf8f5] p-3.5 text-[12px] leading-relaxed whitespace-pre-wrap text-[#4a4f58]">
                {order.whatsappMessage}
              </pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
