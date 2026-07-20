import {
  BarChart3,
  ClipboardList,
  Layers,
  ShoppingCart,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatCop } from "@/lib/format";
import { CategoryTile } from "@/modules/catalog/tiles";

function MetricCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span
          className="flex size-8 items-center justify-center rounded-[9px]"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon className="size-[17px]" strokeWidth={1.8} />
        </span>
      </div>
      <div className="text-[21px] font-extrabold text-kora-black">{value}</div>
    </div>
  );
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("dashboard:view")) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Hola, {session?.user.name}</h1>
        <p className="text-sm text-muted-foreground">
          Tu módulo de trabajo estará disponible aquí cuando se active. Usa el
          menú de la izquierda.
        </p>
      </div>
    );
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [ventasHoy, ventasMes, pendientes, lowStock, recentOrders, topProducts] =
    await Promise.all([
      db.order.aggregate({
        _sum: { total: true },
        where: { confirmedAt: { gte: startOfDay } },
      }),
      db.order.aggregate({
        _sum: { total: true },
        _count: true,
        where: { confirmedAt: { gte: startOfMonth } },
      }),
      db.order.count({ where: { status: "PENDING" } }),
      db.variant.count({
        where: { active: true, product: { active: true }, stockActual: { lte: db.variant.fields.stockMin } },
      }),
      db.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { customer: true },
      }),
      db.product.findMany({
        take: 5,
        where: { active: true },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        include: { category: true, variants: { where: { active: true } } },
      }),
    ]);

  const mesTotal = Number(ventasMes._sum.total ?? 0);
  const ticket = ventasMes._count > 0 ? mesTotal / ventasMes._count : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <MetricCard label="Ventas hoy" value={formatCop(Number(ventasHoy._sum.total ?? 0))} icon={BarChart3} iconBg="#EFE6F7" iconColor="#7A3DB8" />
        <MetricCard label="Ventas del mes" value={formatCop(mesTotal)} icon={Tag} iconBg="#FFE9DD" iconColor="#FF5A1F" />
        <MetricCard label="Pedidos pendientes" value={String(pendientes)} icon={ClipboardList} iconBg="#FBDCE9" iconColor="#D81B60" />
        <MetricCard label="Ticket promedio" value={formatCop(ticket)} icon={ShoppingCart} iconBg="#ECE0F5" iconColor="#8a5cb0" />
        {/* La card oscura del prototipo: stock bajo */}
        <div className="bg-kora-black rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A0A4AD]">Stock bajo</span>
            <span className="flex size-8 items-center justify-center rounded-[9px] bg-[rgba(229,72,77,0.2)] text-[#ff7a7d]">
              <Layers className="size-[17px]" strokeWidth={1.8} />
            </span>
          </div>
          <div className="text-[21px] font-extrabold text-white">
            {lowStock}{" "}
            <span className="text-[13px] font-medium text-white/40">variantes</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[18px] bg-white p-6 shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-bold text-kora-black">Ventas de la semana</h3>
            <span className="text-xs font-semibold text-muted-foreground">
              Las ventas llegan con los pedidos (Semana 8)
            </span>
          </div>
          <div className="flex h-[180px] items-end justify-between gap-3.5">
            {DAYS.map((d, i) => (
              <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10.5px] font-semibold text-muted-foreground">$0</span>
                <div
                  className={`w-full max-w-10 rounded-t-lg ${
                    i === (now.getDay() + 6) % 7 ? "bg-kora-gradient" : "bg-[#f3ede6]"
                  }`}
                  style={{ height: 8 }}
                />
                <span className="text-[11px] font-semibold text-[#b3b8c0]">{d}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[18px] bg-white p-6 shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-base font-bold text-kora-black">Top productos</h3>
          <div className="flex flex-col gap-3.5">
            {topProducts.map((p) => {
              const stock = p.variants.reduce((s, v) => s + v.stockActual, 0);
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <CategoryTile color={p.category.color} icon={p.category.icon} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-kora-black">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {stock} en stock
                    </div>
                  </div>
                  <div className="text-[13px] font-bold whitespace-nowrap text-kora-black">
                    {formatCop(Number(p.variants[0]?.priceCopOnline ?? 0))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-[18px] bg-white p-6 shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
        <h3 className="mb-4 text-base font-bold text-kora-black">Últimos pedidos</h3>
        {recentOrders.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aún no hay pedidos. El primer pedido de punta a punta llega en la
            Semana 8: web → WhatsApp → confirmación → inventario.
          </p>
        ) : (
          <div>
            <div className="grid grid-cols-[1.2fr_1.5fr_1fr_1fr_0.8fr] gap-3 border-b border-[#f0ece6] pb-3 text-[11.5px] font-bold tracking-wide text-[#9aa0ab] uppercase">
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Canal</span>
              <span>Total</span>
              <span>Estado</span>
            </div>
            {recentOrders.map((o) => (
              <div
                key={o.id}
                className="grid grid-cols-[1.2fr_1.5fr_1fr_1fr_0.8fr] items-center gap-3 border-b border-[#f7f4f0] py-3 text-[13px]"
              >
                <span className="font-bold text-kora-black">
                  KORA-{String(o.number).padStart(6, "0")}
                </span>
                <span className="text-[#4a4f58]">{o.customer?.name ?? "—"}</span>
                <span className="text-muted-foreground">
                  {o.channel === "POS" ? "POS" : "Online"}
                </span>
                <span className="font-semibold text-kora-black">
                  {formatCop(Number(o.total))}
                </span>
                <span className="text-muted-foreground">{o.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
