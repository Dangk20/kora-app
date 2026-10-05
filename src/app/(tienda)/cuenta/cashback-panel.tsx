// Kora Cashback en la cuenta del comprador.
// Los cuatro datos que pidió el cliente van JUNTOS a propósito: cada uno
// responde una pregunta distinta y sin los cuatro el comprador escribe por
// WhatsApp. Sin el pendiente cree que su compra no generó nada; sin el
// vencimiento no sabe que va a perderlo; sin el historial no puede discutir
// una cifra que no le cuadra.

import { KoraFlame } from "@/components/kora-flame";
import type { CashbackSummary } from "@/modules/cashback/balance";
import { formatearCashback } from "@/modules/cashback/money";
import { getMessages } from "@/modules/i18n/server";

export async function CashbackPanel({ resumen }: { resumen: CashbackSummary }) {
  const msgs = await getMessages();
  const t = msgs.cuenta.cashback;
  // Las etiquetas del tipo de movimiento salen del diccionario (`cashback.tipos`).
  const fecha = (d: Date) =>
    new Intl.DateTimeFormat(msgs.comun.formatoFecha, { day: "2-digit", month: "long", year: "numeric" }).format(
      new Date(d),
    );
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
        generado: resumen.totals.earned.cop,
        usado: resumen.totals.used.cop,
      },
      {
        currency: "USD" as const,
        saldo: resumen.available.usd,
        pendiente: resumen.pending.usd,
        vence: resumen.nextExpiry.usd,
        generado: resumen.totals.earned.usd,
        usado: resumen.totals.used.usd,
      },
    ]
  ).filter((b) => b.saldo > 0 || b.pendiente > 0 || b.generado > 0);

  return (
    <section className="rounded-[18px] border border-[#ffd9c7] bg-[linear-gradient(120deg,#FFF4EF,#fff)] p-6">
      <div className="flex items-center gap-2.5">
        <KoraFlame className="size-7" />
        <h2 className="text-[17px] font-extrabold text-kora-black">{t.titulo}</h2>
      </div>

      {bolsas.length === 0 ? (
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          {t.vacio1} <strong className="text-kora-black">3 %</strong> {t.vacio2}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {bolsas.map((b) => (
            <div key={b.currency} className="rounded-[14px] bg-white/70 px-4 py-3.5">
              <div className="text-[11px] tracking-wide text-muted-foreground uppercase">
                {t.disponible(b.currency)}
              </div>
              <div className="text-[26px] leading-tight font-extrabold text-kora-black">
                {formatearCashback(b.saldo, b.currency)}
              </div>

              {b.pendiente > 0 && (
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                  <strong className="text-kora-black">
                    {formatearCashback(b.pendiente, b.currency)}
                  </strong>{" "}
                  {t.pendienteTarjeta}
                </p>
              )}
              {b.vence && (
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {t.vence(fecha(b.vence))}
                </p>
              )}

              {/* Las dos cifras sueltas que pidió el cliente: generado y usado
                  en total. Salen del libro; el historial de abajo es el detalle. */}
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[#ffe8dc] pt-3 text-[12.5px]">
                <div>
                  <dt className="text-muted-foreground">{t.generadoTotal}</dt>
                  <dd className="font-semibold text-kora-black">{formatearCashback(b.generado, b.currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t.usadoTotal}</dt>
                  <dd className="font-semibold text-kora-black">{formatearCashback(b.usado, b.currency)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {resumen.history.length > 0 && (
        <div className="mt-5 border-t border-[#ffd9c7] pt-4">
          <h3 className="mb-2 text-[11px] tracking-wide text-muted-foreground uppercase">
            {t.historial}
          </h3>
          <ul>
            {resumen.history.map((m) => (
              <li
                key={m.id}
                className="flex items-baseline justify-between gap-3 border-b border-[#ffe8dc] py-2 text-[13px] last:border-0"
              >
                <span className="text-muted-foreground">
                  {t.tipos[m.type]}
                  {m.orderNumber ? t.pedido(m.orderNumber) : ""}
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
        {t.comoUsarlo}
      </p>
    </section>
  );
}
