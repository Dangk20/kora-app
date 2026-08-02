import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Receipt, Store } from "lucide-react";
import { auth } from "@/auth";
import { businessDayKey, businessDayStart } from "@/lib/business-time";
import { formatCop, formatUsd } from "@/lib/format";
import { currentMonth, EXPORT_MAX_ROWS } from "@/modules/sales/definition";
import { countSales, listSales, salesTotals } from "@/modules/sales/queries";
import type { Currency } from "@/modules/pricing";
import type { SaleChannel } from "@/generated/prisma/enums";
import { Filtros, type FiltrosValores } from "./filtros";

export const metadata = { title: "Ventas · KORA" };

const money = (n: number, c: Currency) => (c === "USD" ? formatUsd(n) : formatCop(n));

const fecha = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(d);

type Params = {
  desde?: string;
  hasta?: string;
  canal?: string;
  moneda?: string;
  page?: string;
};

/** `YYYY-MM-DD` → instante en que empieza ese día EN COLOMBIA. */
function desdeParam(v: string | undefined): Date | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(v ?? "") ? businessDayStart(v as string) : undefined;
}

/** El fin de un día del negocio es el instante justo antes del siguiente. */
function hastaParam(v: string | undefined): Date | undefined {
  const inicio = desdeParam(v);
  return inicio ? new Date(inicio.getTime() + 24 * 3600_000 - 1) : undefined;
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("sales:view")) redirect("/admin");
  const puedeExportar = session.user.permissions.includes("sales:export");

  const sp = await searchParams;
  const mes = currentMonth();

  // Periodo por defecto: el mes en curso. Se dice en pantalla, no se adivina.
  const from = desdeParam(sp.desde) ?? mes.from;
  const to = hastaParam(sp.hasta) ?? mes.to;
  // Se estrechan a propósito antes de consultar: lo que llega en la dirección
  // es texto de quien sea, y un canal inventado no debe llegar a la consulta.
  const channel: SaleChannel | undefined =
    sp.canal === "POS" || sp.canal === "WEB" ? sp.canal : undefined;
  const currency: Currency | undefined =
    sp.moneda === "USD" || sp.moneda === "COP" ? sp.moneda : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const filtros = { from, to, channel, currency };
  const [totales, listado, totalFilas] = await Promise.all([
    salesTotals(filtros),
    listSales({ ...filtros, page }),
    countSales(filtros),
  ]);

  const valores: FiltrosValores = {
    desde: businessDayKey(from),
    hasta: businessDayKey(to),
    canal: channel ?? "",
    moneda: currency ?? "",
  };

  const qs = new URLSearchParams({
    desde: valores.desde,
    hasta: valores.hasta,
    ...(channel ? { canal: channel } : {}),
    ...(currency ? { moneda: currency } : {}),
  });

  const sinVentasPresenciales = channel === "POS" && listado.total === 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-extrabold text-kora-black">Ventas</h1>
        <p className="text-[13px] text-muted-foreground">
          Pedidos confirmados entre el {valores.desde} y el {valores.hasta}, por fecha de
          confirmación.
        </p>
        {puedeExportar && (
          <a
            href={`/admin/ventas/export?${qs.toString()}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border-[1.6px] border-[#e2ddd6] px-4 py-2.5 text-sm font-semibold text-kora-black hover:border-[#d5cec4]"
          >
            <Download className="size-4" /> Exportar
          </a>
        )}
      </div>

      <Filtros valores={valores} />

      {/* Los totales van SEPARADOS por moneda y no se suman jamás: no existe
          tasa de cambio en KORA y un total combinado sería un número sin
          significado que además parecería correcto. */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {totales.length === 0 ? (
          <div className="rounded-[14px] border border-[#eee9e2] bg-white px-5 py-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">
            No hubo ventas en este periodo.
          </div>
        ) : (
          totales.flatMap((t) => [
            <div key={`${t.currency}-total`} className="rounded-[14px] border border-[#eee9e2] bg-white px-5 py-4">
              <div className="text-[12.5px] font-semibold text-[#6b6f78]">
                Vendido · {t.currency}
              </div>
              <div className="mt-1.5 text-[26px] font-extrabold text-kora-black">
                {money(t.total, t.currency)}
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                {t.sales} venta{t.sales === 1 ? "" : "s"}
              </div>
            </div>,
            <div key={`${t.currency}-ticket`} className="rounded-[14px] border border-[#eee9e2] bg-white px-5 py-4">
              <div className="text-[12.5px] font-semibold text-[#6b6f78]">
                Ticket promedio · {t.currency}
              </div>
              <div className="mt-1.5 text-[26px] font-extrabold text-kora-black">
                {money(t.average, t.currency)}
              </div>
              <div className="text-[11.5px] text-muted-foreground">dentro de esta moneda</div>
            </div>,
          ])
        )}
      </div>

      {totales.length > 1 && (
        <p className="mb-4 text-[12px] text-muted-foreground">
          Las monedas se muestran por separado y no se suman: en KORA cada divisa tiene su propio
          precio cargado, no hay tasa de cambio.
        </p>
      )}

      {totalFilas > EXPORT_MAX_ROWS && puedeExportar && (
        <p className="mb-4 rounded-[10px] border border-[#ffd9c7] bg-[#FFF4EF] px-4 py-2.5 text-[12.5px] text-[#8a4520]">
          Este periodo tiene {totalFilas} ventas y la exportación entrega como máximo{" "}
          {EXPORT_MAX_ROWS}. Acota el rango de fechas para llevártelas todas.
        </p>
      )}

      <div className="overflow-hidden rounded-[14px] border border-[#eee9e2] bg-white">
        {listado.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            {sinVentasPresenciales ? (
              <>
                <Store className="mx-auto mb-3 size-9 text-[#cfd3d9]" />
                <p className="font-semibold text-kora-black">Todavía no hay ventas presenciales</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  El punto de venta aún no está en funcionamiento. Cuando lo esté, sus ventas
                  aparecerán aquí junto a las de la tienda.
                </p>
              </>
            ) : (
              <>
                <Receipt className="mx-auto mb-3 size-9 text-[#cfd3d9]" />
                <p className="font-semibold text-kora-black">Sin ventas en este periodo</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Una venta aparece aquí cuando el operador confirma el pago del pedido.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-[#f0ece6] bg-[#fbfaf8] text-left text-[12px] tracking-wide text-[#6b6f78] uppercase">
                <tr>
                  <th className="px-5 py-3 font-semibold">Pedido</th>
                  <th className="px-5 py-3 font-semibold">Confirmado</th>
                  <th className="px-5 py-3 font-semibold">Cliente</th>
                  <th className="px-5 py-3 font-semibold">Canal</th>
                  <th className="px-5 py-3 text-right font-semibold">Total cobrado</th>
                </tr>
              </thead>
              <tbody>
                {listado.rows.map((v) => (
                  <tr key={v.orderId} className="border-b border-[#f5f2ee] last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/pedidos/${v.orderId}`}
                        className="font-bold text-kora-black hover:underline"
                      >
                        KORA-{String(v.number).padStart(6, "0")}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[#4a4f57]">{fecha(v.confirmedAt)}</td>
                    <td className="px-5 py-3 text-[#4a4f57]">{v.customerName ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {v.channel === "POS" ? "Punto de venta" : "Online"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-bold text-kora-black">
                        {money(v.total, v.currency)}
                      </span>
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        {v.currency}
                      </span>
                      {(v.discountTotal > 0 || v.cashbackApplied > 0) && (
                        <div className="text-[11px] text-muted-foreground">
                          {v.discountTotal > 0 && `cupón −${money(v.discountTotal, v.currency)}`}
                          {v.discountTotal > 0 && v.cashbackApplied > 0 && " · "}
                          {v.cashbackApplied > 0 &&
                            `cashback −${money(v.cashbackApplied, v.currency)}`}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {listado.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {listado.total} venta{listado.total === 1 ? "" : "s"} · página {listado.page} de{" "}
            {listado.totalPages}
          </span>
          <div className="flex gap-2">
            {listado.page > 1 && (
              <Link
                href={`/admin/ventas?${qs.toString()}&page=${listado.page - 1}`}
                className="rounded-lg border border-[#e2ddd6] px-3 py-1.5 font-semibold text-kora-black"
              >
                Anterior
              </Link>
            )}
            {listado.page < listado.totalPages && (
              <Link
                href={`/admin/ventas?${qs.toString()}&page=${listado.page + 1}`}
                className="rounded-lg border border-[#e2ddd6] px-3 py-1.5 font-semibold text-kora-black"
              >
                Siguiente
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
