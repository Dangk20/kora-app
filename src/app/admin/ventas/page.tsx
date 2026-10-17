import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Download, LockKeyhole, Receipt } from "lucide-react";
import { auth } from "@/auth";
import { businessDayKey, businessDayStart } from "@/lib/business-time";
import { formatCop, formatUsd } from "@/lib/format";
import { currentMonth, EXPORT_MAX_ROWS } from "@/modules/sales/definition";
import { countSales, salesTotals } from "@/modules/sales/queries";
import { listMovimientos, totalesMovimientos, type Movimiento, type TipoMovimiento } from "@/modules/sales/movements";
import { checkPermission } from "@/modules/auth/permissions";
import { RegistrarMovimiento } from "./registrar-movimiento";
import type { Currency } from "@/modules/pricing";
import type { SaleChannel } from "@/generated/prisma/enums";
import { Filtros, type FiltrosValores } from "./filtros";

export const metadata = { title: "Movimientos" };

const money = (n: number, c: Currency) => (c === "USD" ? formatUsd(n) : formatCop(n));

const fecha = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(d);

type Params = {
  desde?: string;
  hasta?: string;
  canal?: string;
  moneda?: string;
  tipo?: string;
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
  const tipo: TipoMovimiento | undefined =
    sp.tipo === "INGRESO" || sp.tipo === "EGRESO" || sp.tipo === "CIERRE" ? sp.tipo : undefined;

  const filtros = { from, to, channel, currency };
  const [totales, listado, totalFilas, movs] = await Promise.all([
    salesTotals(filtros),
    listMovimientos({ ...filtros, tipo, page }),
    countSales(filtros),
    totalesMovimientos(filtros),
  ]);

  // El botón se decide contra la BASE, como la acción: el permiso es nuevo y
  // un JWT emitido antes de crearlo no lo trae.
  const puedeRegistrar = await checkPermission(session.user.id, "sales:record", session.user.issuedAt)
    .then(() => true)
    .catch(() => false);

  const valores: FiltrosValores = {
    desde: businessDayKey(from),
    hasta: businessDayKey(to),
    canal: channel ?? "",
    moneda: currency ?? "",
    tipo: tipo ?? "",
  };

  const qs = new URLSearchParams({
    desde: valores.desde,
    hasta: valores.hasta,
    ...(channel ? { canal: channel } : {}),
    ...(currency ? { moneda: currency } : {}),
    ...(tipo ? { tipo } : {}),
  });


  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-extrabold text-kora-black">Movimientos</h1>
        <p className="text-[13px] text-muted-foreground">
          Ventas, ingresos y egresos (de caja o registrados a mano) y cierres de caja entre el{" "}
          {valores.desde} y el {valores.hasta}.
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
        {puedeRegistrar && <RegistrarMovimiento />}
        {puedeExportar && (
          <a
            href={`/admin/ventas/export?${qs.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.6px] border-[#e2ddd6] px-4 py-2.5 text-sm font-semibold text-kora-black hover:border-[#d5cec4]"
          >
            <Download className="size-4" /> Exportar ventas
          </a>
        )}
        </div>
      </div>

      <Filtros valores={valores} />

      {/* Los totales van SEPARADOS por moneda y no se suman jamás: no existe
          tasa de cambio en KORA y un total combinado sería un número sin
          significado que además parecería correcto. */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(() => {
          // Pesos siempre que no se filtre solo USD: aunque no haya ventas,
          // puede haber egresos de caja. Las monedas no se mezclan; egresos y
          // balance son solo de pesos (la caja física).
          const filas = [...totales];
          if (currency !== "USD" && !filas.some((t) => t.currency === "COP") && (movs.cantidadEgresos > 0 || movs.cantidadIngresos > 0)) {
            filas.unshift({ currency: "COP", sales: 0, total: 0, average: 0 });
          }
          if (filas.length === 0) {
            return (
              <div className="rounded-[14px] border border-[#eee9e2] bg-white px-5 py-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">
                No hubo movimientos en este periodo.
              </div>
            );
          }
          const Tarjeta = ({ titulo, valor, nota, tono }: { titulo: string; valor: string; nota: string; tono?: string }) => (
            <div className="rounded-[14px] border border-[#eee9e2] bg-white px-5 py-4">
              <div className="text-[12.5px] font-semibold text-[#6b6f78]">{titulo}</div>
              <div className={`mt-1.5 text-[26px] font-extrabold ${tono ?? "text-kora-black"}`}>{valor}</div>
              <div className="text-[11.5px] text-muted-foreground">{nota}</div>
            </div>
          );
          return filas.flatMap((t) => {
            const pesos = t.currency === "COP";
            // Balance = ventas + ingresos manuales − egresos (todo en pesos).
            const balance = t.total + movs.ingresosManuales - movs.egresos;
            return [
              <Tarjeta key={`${t.currency}-ing`} titulo={`Total ingresos en ventas · ${t.currency}`}
                valor={money(t.total, t.currency)}
                nota={`${t.sales} venta${t.sales === 1 ? "" : "s"}${pesos && movs.cantidadIngresos > 0 ? ` · + ${money(movs.ingresosManuales, "COP")} en otros ingresos` : ""}`}
                tono="text-[#2f7d4f]" />,
              ...(pesos
                ? [
                    <Tarjeta key="egr" titulo="Total egresos · COP" valor={money(movs.egresos, "COP")}
                      nota={`${movs.cantidadEgresos} egreso${movs.cantidadEgresos === 1 ? "" : "s"}`} tono="text-destructive" />,
                    <Tarjeta key="bal" titulo="Balance · COP" valor={money(balance, "COP")}
                      nota="ingresos − egresos" tono={balance < 0 ? "text-destructive" : "text-kora-black"} />,
                  ]
                : []),
              <Tarjeta key={`${t.currency}-tk`} titulo={`Ticket promedio · ${t.currency}`}
                valor={money(t.average, t.currency)} nota="dentro de esta moneda" />,
            ];
          });
        })()}
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
            <Receipt className="mx-auto mb-3 size-9 text-[#cfd3d9]" />
            <p className="font-semibold text-kora-black">Sin movimientos en este periodo</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Una venta entra al confirmarse; una salida de caja y un cierre, cuando el cajero los registra.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-[#f0ece6] bg-[#fbfaf8] text-left text-[12px] tracking-wide text-[#6b6f78] uppercase">
                <tr>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Referencia</th>
                  <th className="px-5 py-3 font-semibold">Fecha</th>
                  <th className="px-5 py-3 font-semibold">Detalle</th>
                  <th className="px-5 py-3 font-semibold">Canal</th>
                  <th className="px-5 py-3 text-right font-semibold">Monto</th>
                </tr>
              </thead>
              <tbody>
                {listado.rows.map((m) => (
                  <FilaMovimiento key={m.id} m={m} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {listado.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {listado.total} movimiento{listado.total === 1 ? "" : "s"} · página {listado.page} de{" "}
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

const ETIQUETA_ORIGEN = { CAJA: "Salida de caja", MANUAL: "Registrado a mano" };

function FilaMovimiento({ m }: { m: Movimiento }) {
  const ingreso = m.tipo === "INGRESO";
  return (
    <tr className={`border-b border-[#f5f2ee] last:border-0 ${m.clase === "CIERRE" ? "bg-[#fbfaf8]" : ""}`}>
      <td className="px-5 py-3">
        {m.clase === "CIERRE" ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-kora-black px-2.5 py-1 text-[11px] font-bold text-white">
            <LockKeyhole className="size-3.5" /> Cierre de caja
          </span>
        ) : ingreso ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#e7f4ec] px-2.5 py-1 text-[11px] font-bold text-[#2f7d4f]">
            <ArrowDownLeft className="size-3.5" /> Ingreso
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#fdecec] px-2.5 py-1 text-[11px] font-bold text-destructive">
            <ArrowUpRight className="size-3.5" /> Egreso
          </span>
        )}
      </td>
      <td className="px-5 py-3">
        {m.clase === "VENTA" ? (
          <Link href={`/admin/pedidos/${m.orderId}`} className="font-bold whitespace-nowrap text-kora-black hover:underline">
            KORA-{String(m.number).padStart(6, "0")}
          </Link>
        ) : m.clase === "MOVIMIENTO" ? (
          <span className="font-bold whitespace-nowrap text-kora-black">{ETIQUETA_ORIGEN[m.origen]}</span>
        ) : (
          <span className="font-bold text-kora-black">{m.caja}</span>
        )}
      </td>
      <td className="px-5 py-3 whitespace-nowrap text-[#4a4f57]">{fecha(m.fecha)}</td>
      <td className="px-5 py-3 text-[#4a4f57]">
        {m.clase === "VENTA" && (m.customerName ?? "—")}
        {m.clase === "MOVIMIENTO" && (
          <>
            {m.motivo}
            <div className="text-[11px] text-muted-foreground">por {m.registradoPor}</div>
          </>
        )}
        {m.clase === "CIERRE" && (
          <>
            Base inicial {money(m.baseInicial, "COP")} · {m.ventas} venta{m.ventas === 1 ? "" : "s"} por{" "}
            {money(m.totalVendido, "COP")}
            {m.salidas > 0 && ` · salidas ${money(m.salidas, "COP")}`}
            <div className="text-[11px] text-muted-foreground">
              Efectivo en caja {money(m.efectivoEnCaja, "COP")} ·{" "}
              {m.baseDejada === null ? "sin base para el siguiente turno" : `base dejada ${money(m.baseDejada, "COP")}`} ·
              cerró {m.cerradoPor}
            </div>
          </>
        )}
      </td>
      <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">
        {m.clase === "VENTA" ? (m.channel === "POS" ? "Punto de venta" : "Online") : m.clase === "MOVIMIENTO" && m.origen === "MANUAL" ? "Administración" : "Punto de venta"}
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        {m.clase === "VENTA" && (
          <>
            <span className="font-bold text-[#2f7d4f]">+{money(m.monto, m.currency)}</span>
            <span className="ml-1.5 text-[11px] text-muted-foreground">{m.currency}</span>
            {(m.discountTotal > 0 || m.cashbackApplied > 0) && (
              <div className="text-[11px] text-muted-foreground">
                {m.discountTotal > 0 && `cupón −${money(m.discountTotal, m.currency)}`}
                {m.discountTotal > 0 && m.cashbackApplied > 0 && " · "}
                {m.cashbackApplied > 0 && `cashback −${money(m.cashbackApplied, m.currency)}`}
              </div>
            )}
          </>
        )}
        {m.clase === "MOVIMIENTO" && (
          <>
            <span className={`font-bold ${ingreso ? "text-[#2f7d4f]" : "text-destructive"}`}>
              {ingreso ? "+" : "−"}{money(m.monto, "COP")}
            </span>
            <span className="ml-1.5 text-[11px] text-muted-foreground">COP</span>
          </>
        )}
        {m.clase === "CIERRE" && (
          <span className="text-[12px] font-semibold text-muted-foreground">
            {m.baseDejada === null ? "Sin base" : `Base ${money(m.baseDejada, "COP")}`}
          </span>
        )}
      </td>
    </tr>
  );
}
