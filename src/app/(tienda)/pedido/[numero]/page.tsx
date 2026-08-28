// El estado de UN pedido, sin cuenta (alcance §1.9).
//
// Solo se llega con un token firmado, que se emite en /pedido tras comprobar
// el número más el correo o el celular del propio pedido. Sin token válido,
// esto es un 404 — no una pantalla de "no autorizado", que ya confirmaría que
// el pedido existe.
//
// ⚠️ Sin `loading.tsx` a propósito: esta ruta llama a `notFound()` y el
// streaming manda las cabeceras antes de saber que no hay contenido, así que
// el 404 se serviría como 200. Fijado por `tests/estados-http.test.ts`.
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { orderDetailById } from "@/modules/buyer/orders";
import { formatOrderNumber, whatsappUrl } from "@/modules/orders/message";
import { whatsappNumberFor } from "@/modules/orders/settings";
import { verifyTrackingToken, parseOrderNumber } from "@/modules/orders/tracking";
import { EstadoPedido, money } from "../../cuenta/ui";

export const metadata = {
  title: "Tu pedido · KORA",
  // Un pedido no se indexa. `noindex` además de que haga falta un token: las
  // dos cosas fallan de formas distintas y no se cubren la una a la otra.
  robots: { index: false, follow: false },
};

export default async function PedidoPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ numero }, { t }] = await Promise.all([params, searchParams]);

  const esperado = parseOrderNumber(numero);
  const orderId = t ? verifyTrackingToken(t) : null;
  if (esperado === null || !orderId) notFound();

  const pedido = await orderDetailById(orderId);
  // El token identifica el pedido; el número de la ruta tiene que ser EL MISMO.
  // Si no se comprobara, un token válido serviría cualquier número en la URL y
  // la página mostraría un pedido distinto del que dice la dirección.
  if (!pedido || pedido.number !== esperado) notFound();

  const whatsapp =
    pedido.vigente && pedido.whatsappMessage
      ? whatsappUrl(await whatsappNumberFor(pedido.currency), pedido.whatsappMessage)
      : null;

  return (
    <main className="mx-auto w-full max-w-[760px] px-5 py-10">
      <Link href="/" className="text-[13px] text-muted-foreground underline">
        ← Volver a la tienda
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

      {pedido.status === "PENDING" && (
        <div className="mb-6 rounded-[14px] border border-[#ffd9c7] bg-[#FFF4EF] px-5 py-4">
          {whatsapp ? (
            <>
              <p className="text-[14px] text-kora-black">
                Tu pedido está registrado y el pago se acuerda por WhatsApp. Retoma la conversación
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

      <p className="mt-6 text-[13px] text-muted-foreground">
        Guarda este enlace para volver a consultar tu pedido.{" "}
        <Link href="/cuenta/crear" className="underline">
          Crea una cuenta
        </Link>{" "}
        y tendrás aquí todos tus pedidos y tu saldo de Kora Cashback.
      </p>
    </main>
  );
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-[13.5px] text-muted-foreground">{label}</span>
      <span className="text-[13.5px] text-kora-black">{valor}</span>
    </div>
  );
}
