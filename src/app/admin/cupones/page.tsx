import { redirect } from "next/navigation";
import Link from "next/link";
import { Pencil, Plus, Search, Ticket } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { countByStatus, discountLabel, listCoupons } from "@/modules/coupons/queries";
import { STATUS_LABEL, type CouponStatus } from "@/modules/coupons/status";
import { CouponForm } from "./coupon-form";
import { ToggleButton } from "./toggle-button";

const CHIPS: { key: CouponStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Todos" },
  { key: "ACTIVE", label: "Activos" },
  { key: "EXPIRED", label: "Vencidos" },
  { key: "EXHAUSTED", label: "Agotados" },
  { key: "INACTIVE", label: "Inactivos" },
];

const BADGE: Record<CouponStatus, string> = {
  ACTIVE: "bg-[#e8f6ec] text-[#1f7a3d]",
  EXPIRED: "bg-[#f4f2ef] text-[#8a8f98]",
  EXHAUSTED: "bg-[#fff1e6] text-[#b25a12]",
  INACTIVE: "bg-[#f4f2ef] text-[#8a8f98]",
};

export default async function CuponesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; nuevo?: string; editar?: string }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("coupons:view")) redirect("/admin");
  const puedeCrear = session.user.permissions.includes("coupons:create");
  const puedeEditar = session.user.permissions.includes("coupons:edit");

  const { q = "", estado = "ALL", nuevo, editar } = await searchParams;
  const todos = await listCoupons(q);
  const contadores = countByStatus(todos);
  const filtrados = estado === "ALL" ? todos : todos.filter((c) => c.status === estado);

  const editando = editar
    ? await db.coupon.findUnique({
        where: { id: editar },
        include: { categories: true, products: true },
      })
    : null;

  const [categorias, productos] = await Promise.all([
    db.category.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, variants: { select: { id: true, name: true } } },
    }),
  ]);

  const href = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (estado !== "ALL") p.set("estado", estado);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    const s = p.toString();
    return `/admin/cupones${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-extrabold text-kora-black">Cupones</h1>
        <form className="ml-auto flex items-center gap-2" action="/admin/cupones">
          {estado !== "ALL" && <input type="hidden" name="estado" value={estado} />}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9aa0a8]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por código o nombre"
              className="w-[260px] max-w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] py-2.5 pr-3.5 pl-9 text-sm outline-none focus:border-kora-coral"
            />
          </div>
          {puedeCrear && (
            <Link
              href={href({ nuevo: "1" })}
              className="bg-kora-gradient inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="size-4" /> Crear cupón
            </Link>
          )}
        </form>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Crea códigos de descuento que el comprador aplica en el checkout. El descuento se
        calcula antes de enviar el pedido a WhatsApp.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => {
          const activo = estado === c.key;
          return (
            <Link
              key={c.key}
              href={href(c.key === "ALL" ? {} : { estado: c.key })}
              className={
                activo
                  ? "bg-kora-gradient rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white"
                  : "rounded-full border border-[#e2ddd6] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#6b6f78]"
              }
            >
              {c.label} · {contadores[c.key]}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#eee9e2] bg-white">
        {filtrados.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Ticket className="mx-auto mb-3 size-9 text-[#cfd3d9]" />
            <p className="font-semibold text-kora-black">
              {q || estado !== "ALL" ? "Ningún cupón coincide" : "Todavía no hay cupones"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {q || estado !== "ALL"
                ? "Prueba con otro código, nombre o filtro."
                : "Crea el primero para lanzar una promoción controlada."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[#f0ece6] bg-[#fbfaf8] text-left text-[12px] tracking-wide text-[#6b6f78] uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Cupón</th>
                <th className="px-5 py-3 font-semibold">Descuento</th>
                <th className="px-5 py-3 font-semibold">Usos</th>
                <th className="px-5 py-3 font-semibold">Vence</th>
                <th className="px-5 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-b border-[#f5f2ee] last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Ticket className="size-4 shrink-0 text-[#b8bcc4]" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-[#f4f2ef] px-2 py-0.5 font-mono text-[12.5px] font-bold text-kora-black">
                            {c.code}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[c.status]}`}>
                            {STATUS_LABEL[c.status]}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{c.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-semibold text-kora-black">{discountLabel(c)}</td>
                  <td className="px-5 py-3 text-[#4a4f57]">
                    {c.usedCount} / {c.maxUses ?? "∞"}
                  </td>
                  <td className="px-5 py-3 text-[#4a4f57]">
                    {c.validTo
                      ? c.validTo.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
                      : "Sin vencimiento"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      {puedeEditar && (
                        <>
                          <ToggleButton id={c.id} active={c.active} code={c.code} />
                          <Link
                            href={href({ editar: c.id })}
                            aria-label={`Editar ${c.code}`}
                            className="flex size-8 items-center justify-center rounded-lg bg-[#f5f3f0] text-[#6b6f78] hover:text-kora-black"
                          >
                            <Pencil className="size-4" />
                          </Link>
                        </>
                      )}
                      {/* No existe eliminar: los pedidos históricos referencian
                          el cupón (CUP_HU001 §3). Pausar es la única salida. */}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(nuevo || editando) && (puedeCrear || puedeEditar) && (
        <CouponForm
          coupon={
            editando
              ? {
                  id: editando.id,
                  code: editando.code,
                  name: editando.name,
                  description: editando.description ?? "",
                  type: editando.type,
                  percentValue: editando.percentValue === null ? "" : String(editando.percentValue),
                  amountCop: editando.amountCop === null ? "" : String(editando.amountCop),
                  amountUsd: editando.amountUsd === null ? "" : String(editando.amountUsd),
                  minSubtotalCop: editando.minSubtotalCop === null ? "" : String(editando.minSubtotalCop),
                  minSubtotalUsd: editando.minSubtotalUsd === null ? "" : String(editando.minSubtotalUsd),
                  freeVariantId: editando.freeVariantId ?? "",
                  validFrom: editando.validFrom?.toISOString().slice(0, 10) ?? "",
                  validTo: editando.validTo?.toISOString().slice(0, 10) ?? "",
                  maxUses: editando.maxUses === null ? "" : String(editando.maxUses),
                  perCustomerLimit:
                    editando.perCustomerLimit === null ? "" : String(editando.perCustomerLimit),
                  active: editando.active,
                  firstPurchaseOnly: editando.firstPurchaseOnly,
                  appliesToSaleItems: editando.appliesToSaleItems,
                  scope: editando.scope,
                  categoryIds: editando.categories.map((x) => x.categoryId),
                  productIds: editando.products.map((x) => x.productId),
                  usedCount: editando.usedCount,
                }
              : null
          }
          categorias={categorias}
          productos={productos}
          backTo={href({})}
        />
      )}
    </>
  );
}

export const metadata = { title: "Cupones" };
