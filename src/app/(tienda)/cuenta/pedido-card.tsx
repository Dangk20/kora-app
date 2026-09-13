// La tarjeta de un pedido en "Mis pedidos". UNA definición para escritorio y
// móvil: antes eran dos copias y ya habían empezado a decir cosas distintas.
//
// Lo que se enseña, en este orden, es lo que el comprador viene a saber: en
// qué va (la frase de estado, no una etiqueta), qué compró (con foto y
// talla), y cuánto fue. Referencia: la lista de compras de Mercado Libre,
// sin lo que KORA no tiene (mensajes al vendedor, opinar, cancelar).

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BuyerOrderRow } from "@/modules/buyer/orders";
import { formatOrderNumber, variantDetails } from "@/modules/orders/message";
import { fraseDeEstado, money } from "./ui";

const fecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" }).format(d);

export function PedidoCard({ p }: { p: BuyerOrderRow }) {
  const estado = fraseDeEstado(p.status, p.statusAt);
  const [primera, ...resto] = p.lineas;
  return (
    <Link
      href={`/cuenta/pedidos/${p.number}`}
      className="block rounded-[14px] border border-[#eee9e2] bg-white transition-colors hover:border-[#ddd6cd]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#f0ece6] px-4 py-2.5 text-[12.5px] sm:px-5">
        <span className="font-semibold text-kora-black">{fecha(p.createdAt)}</span>
        <span className="text-muted-foreground">{formatOrderNumber(p.number, p.createdAt)}</span>
      </div>

      <div className="flex gap-3.5 px-4 py-4 sm:gap-5 sm:px-5">
        {/* La foto del primer producto; si hay más, se dice cuántos. */}
        <div className="relative size-[72px] shrink-0 overflow-hidden rounded-[10px] border border-[#eee9e2] bg-[#f7f4f0] sm:size-[88px]">
          {primera?.imageUrl && (
            <Image src={primera.imageUrl} alt="" fill sizes="88px" className="object-contain p-1" unoptimized />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-[12.5px] font-semibold ${estado.tono}`}>{estado.corta}</p>
          <p className="text-[15px] leading-snug font-bold text-kora-black">{estado.titulo}</p>
          {estado.detalle && <p className="text-[12.5px] text-muted-foreground">{estado.detalle}</p>}

          {primera && (
            <p className="mt-2.5 truncate text-[13px] text-[#4a4f58]">
              {primera.productName}
              <span className="text-muted-foreground">
                {" · "}{primera.qty} u.
                {variantDetails(primera.variantName).length > 0 && ` · ${variantDetails(primera.variantName).join(", ")}`}
              </span>
            </p>
          )}
          {resto.length > 0 && (
            <p className="text-[12px] text-muted-foreground">
              y {resto.length} producto{resto.length === 1 ? "" : "s"} más
            </p>
          )}
        </div>

        <div className="hidden shrink-0 flex-col items-end justify-between sm:flex">
          <span className="text-[15px] font-bold text-kora-black">{money(p.total, p.currency)}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-kora-black px-4 py-2 text-[12.5px] font-semibold text-white">
            Ver pedido <ArrowRight className="size-3.5" />
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#f0ece6] px-4 py-2.5 sm:hidden">
        <span className="text-[14px] font-bold text-kora-black">{money(p.total, p.currency)}</span>
        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-kora-coral">
          Ver pedido <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
