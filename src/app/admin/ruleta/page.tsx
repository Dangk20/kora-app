// La ruleta de la apertura en el panel: el QR para imprimir, abrirla o
// cerrarla, y cuánto sale y cuántos quedan de cada premio.
// Ver openspec/changes/ruleta-apertura.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PREMIOS, leerConfig } from "@/modules/ruleta/premios";
import { resumenRuleta } from "@/modules/ruleta/ruleta";
import { EstadoRuleta, PremiosForm, ImprimirQr } from "./ruleta-admin";

export const dynamic = "force-dynamic";

export default async function RuletaAdminPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("loyalty:view")) redirect("/admin");
  const puedeEditar = session.user.permissions.includes("loyalty:adjust");

  // El QR apunta al MISMO dominio desde el que se abre el panel: impreso
  // desde pruebas lleva a pruebas, desde producción a la tienda real.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "korashopp.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/ruleta`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#121212", light: "#ffffff" } });

  const [config, resumen, regalos, categorias] = await Promise.all([
    leerConfig(),
    resumenRuleta(),
    db.variant.findMany({
      where: { sku: { in: PREMIOS.flatMap((p) => (p.sku ? [p.sku] : [])) } },
      select: { sku: true, stockActual: true },
    }),
    db.category.findMany({
      where: { slug: { in: PREMIOS.flatMap((p) => p.categorias ?? []) } },
      select: { slug: true },
    }),
  ]);
  const hay = new Set(categorias.map((c) => c.slug));
  const stock = new Map(regalos.map((v) => [v.sku, v.stockActual]));
  const pesoTotal = PREMIOS.reduce((s, p) => s + (config.premios[p.key]?.peso ?? 0), 0);

  const filas = PREMIOS.map((p) => {
    const ajuste = config.premios[p.key];
    const r = resumen.porPremio[p.key] ?? { ganados: 0, usados: 0 };
    return {
      key: p.key,
      titulo: p.titulo,
      peso: ajuste.peso,
      tope: ajuste.tope,
      probabilidad: pesoTotal > 0 ? (ajuste.peso / pesoTotal) * 100 : 0,
      ganados: r.ganados,
      usados: r.usados,
      stock: p.sku ? (stock.get(p.sku) ?? null) : undefined,
      faltan: (p.categorias ?? []).filter((c) => !hay.has(c)),
      todas: (p.categorias ?? []).length,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-kora-black">Ruleta de la apertura</h1>
          <p className="text-sm text-muted-foreground">
            Un giro por cuenta y por celular. Todos ganan; el premio queda en &quot;Mis beneficios&quot; por 30 días.
          </p>
        </div>
        <EstadoRuleta activa={config.activa} puedeEditar={puedeEditar} />
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border bg-white p-5 text-center">
          <p className="text-[13px] font-bold uppercase tracking-wider text-[#ff5a1f]">QR para la tienda</p>
          <div className="mx-auto mt-3 w-full max-w-[220px]" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="mt-2 break-all text-[12px] text-muted-foreground">{url}</p>
          <ImprimirQr qr={qr} />
          <div className="mt-5 grid grid-cols-2 gap-2 border-t pt-4 text-left">
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Giros</p>
              <p className="text-2xl font-extrabold">{resumen.giros}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Usados</p>
              <p className="text-2xl font-extrabold">
                {Object.values(resumen.porPremio).reduce((s, r) => s + r.usados, 0)}
              </p>
            </div>
          </div>
        </div>

        <PremiosForm filas={filas} puedeEditar={puedeEditar} />
      </div>
    </div>
  );
}
