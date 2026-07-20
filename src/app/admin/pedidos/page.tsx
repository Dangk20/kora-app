import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/modules/pricing";
import { formatOrderNumber } from "@/modules/orders/message";
import {
  EXPIRING_SOON_MINUTES,
  formatTimeLeft,
  minutesLeft,
  STATUS_LABEL,
  STATUS_STYLE,
} from "@/modules/orders/status";
import { OrdersToolbar } from "./orders-toolbar";
import { Pagination } from "../_components/pagination";

const PER_PAGE_OPTIONS = [20, 50, 100];
const DEFAULT_PER_PAGE = 20;

const GRID =
  "grid grid-cols-[1fr_1.6fr_1fr_1fr_1.1fr_0.9fr] items-center gap-3.5 px-6";

const STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    estado?: string;
    moneda?: string;
    desde?: string;
    hasta?: string;
    por?: string;
    pagina?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("orders:view")) redirect("/admin");
  const sp = await searchParams;

  const perPage = PER_PAGE_OPTIONS.includes(Number(sp.por))
    ? Number(sp.por)
    : DEFAULT_PER_PAGE;
  const page = Math.max(1, Number(sp.pagina) || 1);

  const where: Record<string, unknown> = {};
  if (sp.q?.trim()) {
    const term = sp.q.trim();
    const asNumber = Number(term.replace(/\D/g, ""));
    where.OR = [
      { contactName: { contains: term, mode: "insensitive" } },
      { contactEmail: { contains: term, mode: "insensitive" } },
      { contactPhone: { contains: term.replace(/\D/g, "") } },
      ...(Number.isFinite(asNumber) && asNumber > 0 ? [{ number: asNumber }] : []),
    ];
  }
  if (sp.estado && STATUSES.includes(sp.estado as OrderStatus)) {
    where.status = sp.estado as OrderStatus;
  }
  if (sp.moneda === "COP" || sp.moneda === "USD") where.currency = sp.moneda;
  if (sp.desde || sp.hasta) {
    const range: { gte?: Date; lte?: Date } = {};
    if (sp.desde) range.gte = new Date(`${sp.desde}T00:00:00`);
    if (sp.hasta) range.lte = new Date(`${sp.hasta}T23:59:59`);
    where.createdAt = range;
  }

  const [total, orders, pendingCount] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      include: { customer: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.order.count({ where: { status: "PENDING" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const now = new Date();

  return (
    <>
      <OrdersToolbar total={total} pendingCount={pendingCount} />

      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
        <div
          className={`${GRID} border-b border-[#f0ece6] py-4 text-[11.5px] font-bold tracking-wide text-[#9aa0ab] uppercase`}
        >
          <span>Pedido</span>
          <span>Cliente</span>
          <span>Total</span>
          <span>Estado</span>
          <span>Vigencia</span>
          <span />
        </div>

        {orders.map((o) => {
          const left = o.status === "PENDING" ? minutesLeft(o.expiresAt, now) : null;
          const expiringSoon =
            left !== null && left > 0 && left <= EXPIRING_SOON_MINUTES;
          const expired = left !== null && left <= 0;
          const style = STATUS_STYLE[o.status];

          return (
            <Link
              key={o.id}
              href={`/admin/pedidos/${o.id}`}
              className={`${GRID} border-b border-[#f7f4f0] py-3.5 text-[13px] last:border-0 hover:bg-[#faf8f5]`}
            >
              <div>
                <div className="font-semibold text-kora-black">
                  {formatOrderNumber(o.number, o.createdAt)}
                </div>
                <div className="text-[11.5px] text-[#9aa0ab]">
                  {o.createdAt.toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              <div className="min-w-0">
                <div className="truncate text-kora-black">
                  {o.contactName ?? o.customer?.name ?? "—"}
                </div>
                <div className="truncate text-[11.5px] text-[#9aa0ab]">
                  {o.shipCity ?? ""} · {o._count.items}{" "}
                  {o._count.items === 1 ? "ítem" : "ítems"}
                </div>
              </div>

              <span className="font-bold text-kora-black">
                {formatMoney(Number(o.total), o.currency)}
                <span className="ml-1 text-[11px] font-medium text-[#9aa0ab]">
                  {o.currency}
                </span>
              </span>

              <span>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: style.bg, color: style.color }}
                >
                  {STATUS_LABEL[o.status]}
                </span>
              </span>

              <span
                className="text-[12.5px] font-semibold"
                style={{
                  color: expired
                    ? "#E5484D"
                    : expiringSoon
                      ? "#FF5A1F"
                      : "#8a8f98",
                }}
              >
                {o.status === "PENDING"
                  ? expired
                    ? "Expirado"
                    : `Expira en ${formatTimeLeft(left)}`
                  : "—"}
              </span>

              <span className="justify-self-end rounded-lg bg-[#f5f3f0] px-3.5 py-2 text-[12.5px] font-semibold text-kora-black">
                Ver
              </span>
            </Link>
          );
        })}

        {orders.length === 0 && (
          <div className="py-16 text-center">
            <Inbox className="mx-auto size-12 text-[#e2ddd6]" />
            <p className="mt-3 text-[15px] font-semibold text-kora-black">
              {total === 0 ? "Todavía no hay pedidos" : "Ningún pedido coincide"}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {total === 0
                ? "Los pedidos de la tienda aparecerán aquí apenas se creen."
                : "Prueba con otra búsqueda o quita los filtros."}
            </p>
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        perPage={perPage}
        params={{
          q: sp.q,
          estado: sp.estado,
          moneda: sp.moneda,
          desde: sp.desde,
          hasta: sp.hasta,
          por: sp.por,
        }}
        basePath="/admin/pedidos"
      />
    </>
  );
}
