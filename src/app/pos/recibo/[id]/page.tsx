import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ensureSalesDocument } from "@/modules/invoicing/document";
import { formatMoney } from "@/modules/pricing";
import { ImprimirRecibo } from "./imprimir";

export const metadata: Metadata = { title: "Recibo" };

// El recibo de caja (change s09-pos-caja): 80 mm, desde el navegador.
// Se dibuja desde el COMPROBANTE CONGELADO, no desde el pedido de hoy: lo que
// se imprime es lo que se cobró, aunque el producto cambie de precio mañana.
// Lleva la estructura de un documento de venta colombiano (vendedor, NIT,
// consecutivo, fecha y hora, código + descripción + cantidad + valor, medio de
// pago) para que integrarlo con un proveedor de facturación electrónica sea
// traducir campos. Y dice que NO es factura electrónica, porque no lo es.
export default async function ReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.permissions?.includes("pos:view")) redirect("/admin");
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    select: { channel: true, note: true, confirmedBy: { select: { name: true } } },
  });
  if (!order || order.channel !== "POS") notFound();
  const doc = await ensureSalesDocument(id);
  if (!doc) notFound();
  const s = doc.snapshot;

  const money = (v: string | number) => formatMoney(Number(v), "COP");
  const fecha = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(s.issuedAt));
  // "Venta en caja · Efectivo · recibido 50000 · vueltas 16000"
  const recibido = order.note?.match(/recibido (\d+)/)?.[1];
  const vueltas = order.note?.match(/vueltas (\d+)/)?.[1];

  return (
    <div className="flex flex-1 flex-col items-center gap-5 overflow-y-auto p-6 print:block print:overflow-visible print:p-0">
      <style>{`@page { size: 80mm auto; margin: 4mm; }`}</style>

      <article className="w-[80mm] bg-white p-4 font-mono text-[11.5px] leading-snug text-black shadow-[0_4px_18px_rgba(0,0,0,0.08)] print:w-full print:p-0 print:shadow-none">
        <header className="text-center">
          <p className="text-[15px] font-bold tracking-wide">KORA</p>
          <p className="font-bold">{s.merchant.razonSocial}</p>
          <p>NIT {s.merchant.nit}</p>
          <p>{s.merchant.domicilio}</p>
        </header>

        <div className="my-2 border-t border-dashed border-black" />
        <p className="text-center font-bold">COMPROBANTE DE VENTA</p>
        <p>N.º {s.orderCode}</p>
        <p>Fecha: {fecha}</p>
        {order.confirmedBy?.name && <p>Atendió: {order.confirmedBy.name}</p>}
        <p>
          Cliente: {s.buyer.name || "Consumidor final"}
          {s.buyer.document ? ` · ${s.buyer.document}` : ""}
        </p>

        <div className="my-2 border-t border-dashed border-black" />
        <table className="w-full">
          <thead>
            <tr className="text-left">
              <th className="font-bold">Cant · Descripción</th>
              <th className="text-right font-bold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.sku} className="align-top">
                <td className="pt-1 pr-2">
                  {l.qty} × {l.productName}
                  {l.variantName && !/^[úu]nica$/i.test(l.variantName) ? ` (${l.variantName})` : ""}
                  <br />
                  <span className="text-[10px]">
                    {l.sku} · {money(l.unitPrice)} c/u
                  </span>
                </td>
                <td className="pt-1 text-right">{money(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-2 border-t border-dashed border-black" />
        <p className="flex justify-between text-[14px] font-bold">
          <span>TOTAL</span>
          <span>{money(s.totals.total)}</span>
        </p>
        <p className="text-[10px]">Precios con IVA incluido</p>
        <p className="mt-1">Medio de pago: {s.paymentPreference}</p>
        {recibido && <p>Recibido: {money(recibido)}</p>}
        {vueltas && <p>Vueltas: {money(vueltas)}</p>}

        <div className="my-2 border-t border-dashed border-black" />
        <p className="text-center font-bold">¡Gracias por tu compra!</p>
        <p className="text-center">korashopp.com</p>
        <p className="mt-2 text-center text-[9.5px]">Este recibo no es factura electrónica.</p>
      </article>

      <div className="flex gap-3 print:hidden">
        <ImprimirRecibo />
        <Link href="/pos" className="rounded-full border-[1.6px] border-[#e2ddd6] bg-white px-6 py-3 text-[14px] font-bold text-kora-black hover:border-kora-coral">
          Nueva venta
        </Link>
      </div>
    </div>
  );
}
