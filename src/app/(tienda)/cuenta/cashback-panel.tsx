// Kora Cashback en la cuenta del comprador.
// Los cuatro datos que pidió el cliente van JUNTOS a propósito: cada uno
// responde una pregunta distinta y sin los cuatro el comprador escribe por
// WhatsApp. Sin el pendiente cree que su compra no generó nada; sin el
// vencimiento no sabe que va a perderlo; sin el historial no puede discutir
// una cifra que no le cuadra.

import { KoraFlame } from "@/components/kora-flame";
import type { CashbackSummary } from "@/modules/cashback/balance";
import { formatearCashback } from "@/modules/cashback/money";

const ETIQUETA = {
  EARN: "Ganado",
  REDEEM: "Usado",
  EXPIRE: "Vencido",
  ADJUST: "Ajuste",
} as const;

const fecha = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(d),
  );

export function CashbackPanel({ resumen }: { resumen: CashbackSummary }) {
  // Las dos monedas NUNCA se suman: no existe tasa de cambio en KORA y es
  // deliberado. Un total combinado sería un número sin significado que además
  // parecería correcto.
  const bolsas = (
    [
      {
        currency: "COP" as const,
        saldo: resumen.available.cop,
        pendiente: resumen.pending.cop,
        vence: resumen.nextExpiry.cop,
      },
      {
        currency: "USD" as const,
        saldo: resumen.available.usd,
        pendiente: resumen.pending.usd,
        vence: resumen.nextExpiry.usd,
      },
    ]
  ).filter((b) => b.saldo > 0 || b.pendiente > 0);

  return (
    <section className="rounded-[18px] border border-[#ffd9c7] bg-[linear-gradient(120deg,#FFF4EF,#fff)] p-6">
      <div className="flex items-center gap-2.5">
        <KoraFlame className="size-7" />
        <h2 className="text-[17px] font-extrabold text-kora-black">Kora Cashback</h2>
      </div>

      {bolsas.length === 0 ? (
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          Todavía no tienes saldo. Recibe el <strong className="text-kora-black">3 %</strong> de lo
          que pagas en cada compra y úsalo como descuento en la siguiente. Se acredita cuando
          confirmamos tu pedido por WhatsApp.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {bolsas.map((b) => (
            <div key={b.currency} className="rounded-[14px] bg-white/70 px-4 py-3.5">
              <div className="text-[11px] tracking-wide text-muted-foreground uppercase">
                Disponible {b.currency}
              </div>
              <div className="text-[26px] leading-tight font-extrabold text-kora-black">
                {formatearCashback(b.saldo, b.currency)}
              </div>

              {b.pendiente > 0 && (
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                  <strong className="text-kora-black">
                    {formatearCashback(b.pendiente, b.currency)}
                  </strong>{" "}
                  pendiente — estará disponible cuando confirmemos tu pedido.
                </p>
              )}
              {b.vence && (
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Lo próximo vence el {fecha(b.vence)}.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {resumen.history.length > 0 && (
        <div className="mt-5 border-t border-[#ffd9c7] pt-4">
          <h3 className="mb-2 text-[11px] tracking-wide text-muted-foreground uppercase">
            Historial
          </h3>
          <ul>
            {resumen.history.map((m) => (
              <li
                key={m.id}
                className="flex items-baseline justify-between gap-3 border-b border-[#ffe8dc] py-2 text-[13px] last:border-0"
              >
                <span className="text-muted-foreground">
                  {ETIQUETA[m.type]}
                  {m.orderNumber ? ` · pedido ${m.orderNumber}` : ""}
                  <span className="ml-2 text-[11.5px]">{fecha(m.createdAt)}</span>
                </span>
                <span
                  className={
                    m.delta > 0 ? "font-semibold text-kora-black" : "text-muted-foreground"
                  }
                >
                  {m.delta > 0 ? "+" : "−"}
                  {formatearCashback(Math.abs(m.delta), m.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[12px] text-muted-foreground">
        Puedes usarlo como descuento al finalizar tu próxima compra. No se combina con cupones.
      </p>
    </section>
  );
}
