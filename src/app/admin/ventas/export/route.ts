// Descarga del CSV de ventas.
// Ver openspec/changes/modulo-ventas — specs/sales-reporting.

import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/auth";
import { businessDayStart } from "@/lib/business-time";
import { csvFilename, salesToCsv } from "@/modules/sales/csv";
import { currentMonth, EXPORT_MAX_ROWS } from "@/modules/sales/definition";
import { allSales } from "@/modules/sales/queries";

function diaParam(v: string | null): Date | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(v ?? "") ? businessDayStart(v as string) : undefined;
}

export async function GET(request: NextRequest) {
  // Permiso PROPIO: exportar es sacar los datos del negocio del sistema. Se
  // verifica contra la base, no contra el token — retirárselo a alguien tiene
  // que surtir efecto ya.
  await requirePermission("sales:export");

  const sp = request.nextUrl.searchParams;
  const mes = currentMonth();
  const desde = diaParam(sp.get("desde"));
  const hastaDia = diaParam(sp.get("hasta"));

  const canal = sp.get("canal");
  const moneda = sp.get("moneda");

  const rows = await allSales(
    {
      from: desde ?? mes.from,
      // El fin del día del negocio: el instante justo antes del siguiente.
      to: hastaDia ? new Date(hastaDia.getTime() + 24 * 3600_000 - 1) : mes.to,
      channel: canal === "WEB" || canal === "POS" ? canal : undefined,
      currency: moneda === "COP" || moneda === "USD" ? moneda : undefined,
    },
    EXPORT_MAX_ROWS,
  );

  const csv = salesToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(desde ?? mes.from, hastaDia ?? mes.to)}"`,
      // No se guarda en caché: son cifras del negocio y cambian con cada venta.
      "Cache-Control": "no-store",
    },
  });
}
