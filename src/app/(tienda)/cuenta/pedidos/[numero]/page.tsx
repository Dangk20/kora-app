import Link from "next/link";
import { formatOrderNumber } from "@/modules/orders/message";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { requireBuyer } from "@/modules/buyer/guard";
import { buyerOrder } from "@/modules/buyer/orders";
import { whatsappUrl } from "@/modules/orders/message";
import { whatsappNumberFor } from "@/modules/orders/settings";
import { EstadoPedido, money } from "../../ui";

export const metadata = { title: "Detalle del pedido · KORA" };

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;
  const buyer = await requireBuyer(`/cuenta/pedidos/${numero}`);

  const n = Number(numero);
  if (!Number.isInteger(n)) notFound();

  // El comprador va en la consulta, no en una comprobación posterior: un pedido
  // de otra persona simplemente no existe aquí.
  const pedido = await buyerOrder(buyer.customerId, n);
  if (!pedido) notFound();

  const whatsapp =
    pedido.vigente && pedido.whatsappMessage
      ? whatsappUrl(await whatsappNumberFor(pedido.currency), pedido.whatsappMessage)
      : null;

  return (
    <main className="mx-auto w-full max-w-[760px] px-5 py-10">
      <Link href="/cuenta" className="text-[13px] text-muted-foreground underline">
        ← Volver a mi cuenta
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-kora-black">
            {formatOrderNumber(pedido.number, pedido.createdAt)}
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            {new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(pedido.createdAt)}
          </p>
        </div>
        <EstadoPedido status={pedido.status} />
      </div>

      {/* En KORA el pago se acuerda por WhatsApp: un pedido pendiente no es un
          error. Decirlo evita que el comprador crea que su compra falló. */}
      {pedido.status === "PENDING" && (
        <div className="mb-6 rounded-[14px] border border-[#ffd9c7] bg-[#FFF4EF] px-5 py-4">
          {whatsapp ? (
            <>
              <p className="text-[14px] text-kora-black">
                Tu pedido está reservado y el pago se acuerda por WhatsApp. Retoma la conversación
                para confirmarlo.
              </p>
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-kora-gradient mt-3 inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[14px] font-semibold text-white"
              >
                <MessageCircle className="size-4" /> Continuar por WhatsApp
              </a>
            </>
          ) : (
            <p className="text-[14px] text-kora-black">
              Este pedido superó su vigencia sin confirmarse. Si todavía lo quieres, vuelve a
              armarlo desde el catálogo.
            </p>
          )}
        </div>
      )}

      <section className="rounded-[14px] border border-[#eee9e2]">
        <ul>
          {pedido.items.map((i) => (
            <li
              key={i.id}
              className="flex items-baseline justify-between gap-4 border-b border-[#f0ece6] px-5 py-3.5 last:border-0"
            >
              <div>
                <div className="text-[14.5px] font-semibold text-kora-black">{i.productName}</div>
                <div className="text-[12.5px] text-muted-foreground">
                  {i.variantName} · {i.qty} × {money(i.unitPrice, pedido.currency)}
                </div>
              </div>
              <div className="text-[14.5px] font-bold text-kora-black">
                {money(i.total, pedido.currency)}
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-[#f0ece6] px-5 py-4">
          <Fila label="Subtotal" valor={money(pedido.subtotal, pedido.currency)} />
          {pedido.discountTotal > 0 && (
            <Fila label="Descuento" valor={`− ${money(pedido.discountTotal, pedido.currency)}`} />
          )}
          {pedido.cashbackApplied > 0 && (
            <Fila
              label="Kora Cashback"
              valor={`− ${money(pedido.cashbackApplied, pedido.currency)}`}
            />
          )}
          <div className="mt-2 flex justify-between border-t border-[#f0ece6] pt-3">
            <span className="text-[15px] font-bold text-kora-black">Total</span>
            <span className="text-[17px] font-extrabold text-kora-black">
              {money(pedido.total, pedido.currency)}
            </span>
          </div>
        </div>
      </section>

      {pedido.cashback > 0 && (
        <p className="mt-4 text-[13.5px] text-muted-foreground">
          {pedido.cashbackAcreditado ? (
            <>
              Este pedido te dio{" "}
              <strong className="text-kora-black">
                {money(pedido.cashback, pedido.currency)}
              </strong>{" "}
              de Kora Cashback
              {pedido.cashbackVence && (
                <>
                  , disponible hasta el{" "}
                  {new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(
                    pedido.cashbackVence,
                  )}
                </>
              )}
              .
            </>
          ) : (
            <>
              Al confirmarse te dará{" "}
              <strong className="text-kora-black">
                {money(pedido.cashback, pedido.currency)}
              </strong>{" "}
              de Kora Cashback.
            </>
          )}
        </p>
      )}

      {(pedido.shipAddress || pedido.contactPhone) && (
        <section className="mt-6 rounded-[14px] border border-[#eee9e2] px-5 py-4">
          <h2 className="mb-2 text-[11px] tracking-wide text-muted-foreground uppercase">
            Entrega
          </h2>
          {pedido.contactName && <p className="text-[14px]">{pedido.contactName}</p>}
          {pedido.contactPhone && (
            <p className="text-[13.5px] text-muted-foreground">{pedido.contactPhone}</p>
          )}
          {pedido.shipAddress && (
            <p className="text-[13.5px] text-muted-foreground">
              {pedido.shipAddress}
              {pedido.shipCity ? `, ${pedido.shipCity}` : ""}
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between py-1 text-[14px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-kora-black">{valor}</span>
    </div>
  );
}
