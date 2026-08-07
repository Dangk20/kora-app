// La cuenta en móvil, tal como el prototipo (§07 del diseño móvil).
//
// NO es la de escritorio adaptada, y el intento anterior lo fue: se le puso la
// barra lateral con pestañas también en el teléfono. El diseño móvil no tiene
// pestañas — apila franja de usuario, saldo y pedidos, porque en una pantalla
// de 390 px unas pestañas esconden dos de las tres cosas que el comprador vino
// a ver, y el saldo de cashback es justamente la que más se consulta.
//
// Escritorio conserva su barra lateral: son dos diseños, no uno degradado.

import Link from "next/link";
import type { CashbackSummary } from "@/modules/cashback/balance";
import { formatearCashback } from "@/modules/cashback/money";
import type { BuyerOrderRow } from "@/modules/buyer/orders";
import { formatOrderNumber } from "@/modules/orders/message";
import { EstadoPedido, money } from "./ui";
import { bolsasVisibles } from "./bolsas";

/** Dos iniciales, como el diseño ("Laura Martinez" → "LM"). */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primera = partes[0][0] ?? "";
  const segunda = partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "";
  return (primera + segunda).toUpperCase();
}

export function CuentaMovil({
  nombre,
  email,
  resumen,
  pedidos,
  salir,
  datos,
}: {
  nombre: string;
  email: string;
  resumen: CashbackSummary;
  pedidos: BuyerOrderRow[];
  salir: React.ReactNode;
  datos: React.ReactNode;
}) {
  const bolsas = bolsasVisibles(resumen.available);
  const varias = bolsas.length > 1;

  return (
    <div className="lg:hidden">
      {/* Franja de usuario, a sangre y pegada bajo la banda de búsqueda. */}
      <div className="flex items-center gap-[13px] bg-[#16181D] px-4 py-[18px]">
        <span
          className="bg-kora-gradient flex size-[46px] shrink-0 items-center justify-center rounded-full text-[16px] font-extrabold text-white"
          aria-hidden
        >
          {iniciales(nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-extrabold text-white">{nombre}</p>
          {email && <p className="truncate text-[12px] text-[#A0A4AD]">{email}</p>}
        </div>
        {salir}
      </div>

      <div className="p-3.5">
        {/* Saldo: lo primero, porque es lo que más se consulta.
            Con las dos monedas, van EN LÍNEA y se deslizan — nunca apiladas:
            dos tarjetas de saldo una debajo de otra empujan los pedidos fuera
            de la pantalla, y sugieren un total que no existe. Con una sola,
            ocupa el ancho completo y no hay nada que deslizar. */}
        <div
          className={`mb-3.5 flex ${
            varias
              ? "-mx-3.5 snap-x snap-mandatory gap-3 overflow-x-auto px-3.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : ""
          }`}
        >
          {bolsas.map(({ moneda, valor }) => (
            <div
              key={moneda}
              className={`bg-kora-gradient rounded-2xl p-5 text-white ${
                // El 88 % deja asomar la siguiente: es lo que le dice al pulgar
                // que hay otra moneda.
                varias ? "w-[88%] shrink-0 snap-start" : "w-full"
              }`}
            >
              <p className="mb-1 text-[12.5px] opacity-90">
                Kora Cashback disponible{varias ? ` · ${moneda}` : ""}
              </p>
              <p className="text-[30px] leading-none font-extrabold tracking-[-0.5px]">
                {formatearCashback(valor, moneda)}
              </p>
              <p className="mt-1.5 text-[11.5px] opacity-85">
                Ganas 3% en cada pedido confirmado
              </p>
            </div>
          ))}
        </div>

        {/* Pendiente: sin esto, quien acaba de comprar cree que no generó nada. */}
        {(resumen.pending.cop > 0 || resumen.pending.usd > 0) && (
          <p className="mb-3.5 -mt-1 px-1 text-[12px] text-[#8a8f98]">
            {[
              resumen.pending.cop > 0 ? formatearCashback(resumen.pending.cop, "COP") : null,
              resumen.pending.usd > 0 ? formatearCashback(resumen.pending.usd, "USD") : null,
            ]
              .filter(Boolean)
              .join(" · ")}{" "}
            pendiente — se acredita cuando confirmemos tu pedido.
          </p>
        )}

        <h2 className="mb-2.5 text-[16px] font-extrabold text-kora-black">Mis pedidos</h2>

        {pedidos.length === 0 ? (
          <div className="rounded-[14px] bg-white px-[18px] py-7 text-center text-[13px] text-[#8a8f98]">
            Aún no tienes pedidos.{" "}
            <Link href="/catalogo" className="font-semibold text-kora-black underline">
              Ver el catálogo
            </Link>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {pedidos.map((p) => (
              <li key={p.id}>
                <Link href={`/cuenta/pedidos/${p.number}`} className="block rounded-[14px] bg-white p-3.5">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-extrabold text-kora-black">
                      {formatOrderNumber(p.number, p.createdAt)}
                    </span>
                    <EstadoPedido status={p.status} />
                  </div>
                  <p className="mb-2 text-[12px] text-[#8a8f98]">
                    {new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(p.createdAt)} ·{" "}
                    {p.items} artículo{p.items === 1 ? "" : "s"}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-extrabold text-kora-black">
                      {money(p.total, p.currency)}
                    </span>
                    {p.cashback > 0 && (
                      <span className="text-[12px] text-[#8a8f98]">
                        {p.cashbackPendiente ? "Generará" : "Generó"}{" "}
                        {money(p.cashback, p.currency)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* "Mis datos" no aparece en la pantalla del prototipo, pero la función
            existe y tiene que ser alcanzable. Va al final: es lo que menos se
            consulta y lo que más ocupa. */}
        <details className="group mt-5 rounded-[14px] bg-white p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-extrabold text-kora-black [&::-webkit-details-marker]:hidden">
            Mis datos
            <span className="text-[#b3b8c0] transition-transform group-open:rotate-180" aria-hidden>
              ⌄
            </span>
          </summary>
          <div className="mt-4">{datos}</div>
        </details>
      </div>
    </div>
  );
}
