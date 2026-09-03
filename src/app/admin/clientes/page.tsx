import { redirect } from "next/navigation";
import { ACTION_ICON } from "../_components/action-icon";
import Link from "next/link";
import { Eye, Pencil, Plus, Search, UsersRound } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cashbackSummary } from "@/modules/cashback/balance";
import { subscriptionState } from "@/modules/consent/subscription";
import { customerMetrics, topCategories, whatsappLink } from "@/modules/customers/profile";
import { customerSummary, listCustomers, PAGE_SIZE } from "@/modules/customers/queries";
import { CustomerForm } from "./customer-form";
import { CustomerSheet } from "./customer-sheet";

// Días como los pide CLI_HU001: L M M J V S D. El índice de PostgreSQL es
// 0 = domingo, así que el orden de presentación empieza en lunes.
const DIAS = [
  { dow: 1, label: "L" },
  { dow: 2, label: "M" },
  { dow: 3, label: "M" },
  { dow: 4, label: "J" },
  { dow: 5, label: "V" },
  { dow: 6, label: "S" },
  { dow: 0, label: "D" },
];

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Resumen({ label, hint, value }: { label: string; hint?: string; value: number }) {
  return (
    <div className="rounded-[14px] border border-[#eee9e2] bg-white px-5 py-4">
      <div className="text-[12.5px] font-semibold text-[#6b6f78]">{label}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      <div className="mt-1.5 text-[26px] font-extrabold text-kora-black">{value}</div>
    </div>
  );
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; ver?: string; nuevo?: string; editar?: string }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("customers:view")) redirect("/admin");
  const puedeCrear = session.user.permissions.includes("customers:create");
  const puedeEditar = session.user.permissions.includes("customers:edit");

  const { q = "", page = "1", ver, nuevo, editar } = await searchParams;
  const pagina = Math.max(1, Number(page) || 1);

  const [resumen, listado] = await Promise.all([
    customerSummary(),
    listCustomers({ search: q, page: pagina, pageSize: PAGE_SIZE }),
  ]);

  // Paneles laterales controlados por la dirección, como el resto del panel:
  // así son enlazables y sobreviven a recargar.
  const verCliente = ver ? await db.customer.findUnique({ where: { id: ver } }) : null;
  const editarCliente = editar
    ? await db.customer.findUnique({ where: { id: editar } })
    : null;

  const perfil = verCliente
    ? {
        metrics: await customerMetrics(verCliente.id),
        cashback: await cashbackSummary(verCliente.id),
        suscripcion: await subscriptionState(verCliente.id),
        top: await topCategories(verCliente.id),
        whatsapp: whatsappLink(verCliente.phone),
      }
    : null;

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumen label="Clientes nuevos" hint="últimos 30 días" value={resumen.nuevos} />
        <Resumen label="Clientes activos" hint="últimos 30 días" value={resumen.activos} />
        <Resumen label="Total de clientes" value={resumen.total} />
        <Resumen label="Clientes con cuenta" value={resumen.conCuenta} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-extrabold text-kora-black">Clientes</h1>
        <form className="ml-auto flex items-center gap-2" action="/admin/clientes">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9aa0a8]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre, WhatsApp o email"
              className="w-[300px] max-w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] py-2.5 pr-3.5 pl-9 text-sm outline-none focus:border-kora-coral"
            />
          </div>
          {puedeCrear && (
            <Link
              href="/admin/clientes?nuevo=1"
              className="bg-kora-gradient inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="size-4" /> Crear cliente
            </Link>
          )}
        </form>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#eee9e2] bg-white">
        {listado.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <UsersRound className="mx-auto mb-3 size-9 text-[#cfd3d9]" />
            <p className="font-semibold text-kora-black">
              {q ? "Ningún cliente coincide con la búsqueda" : "Todavía no hay clientes"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {q
                ? "Prueba con otro nombre, número o correo."
                : "Se crean solos con cada compra en la tienda, o puedes añadirlos a mano."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[#f0ece6] bg-[#fbfaf8] text-left text-[12px] tracking-wide text-[#6b6f78] uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="px-5 py-3 font-semibold">WhatsApp</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">País</th>
                <th className="px-5 py-3 font-semibold">Días de mayor pedido</th>
                <th className="px-5 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listado.rows.map((c) => (
                <tr key={c.id} className="border-b border-[#f5f2ee] last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-kora-gradient flex size-9 items-center justify-center rounded-full text-[12px] font-bold text-white">
                        {iniciales(c.name)}
                      </span>
                      <span className="font-semibold text-kora-black">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[#4a4f57]">{c.phone ?? "—"}</td>
                  <td className="px-5 py-3 text-[#4a4f57]">
                    {c.email ?? <span className="text-muted-foreground">No registrado</span>}
                  </td>
                  <td className="px-5 py-3 text-[#4a4f57]">{c.country}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {DIAS.map((d, i) => {
                        const activo = c.topWeekdays.includes(d.dow);
                        return (
                          <span
                            key={i}
                            title={activo ? "Uno de sus días con más pedidos" : undefined}
                            className={
                              activo
                                ? "bg-kora-gradient flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                : "flex size-6 items-center justify-center rounded-full bg-[#f4f2ef] text-[10px] font-semibold text-[#b8bcc4]"
                            }
                          >
                            {d.label}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/admin/clientes?ver=${c.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                        aria-label={`Ver ${c.name}`}
                        className={ACTION_ICON}
                      >
                        <Eye className="size-4" />
                      </Link>
                      {puedeEditar && (
                        <Link
                          href={`/admin/clientes?editar=${c.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                          aria-label={`Editar ${c.name}`}
                          className={ACTION_ICON}
                        >
                          <Pencil className="size-4" />
                        </Link>
                      )}
                      {/* No existe acción de eliminar: el histórico es permanente
                          porque alimenta remarketing y fidelización (CLI_HU001). */}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {listado.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {listado.total} cliente{listado.total === 1 ? "" : "s"} · página {listado.page} de{" "}
            {listado.totalPages}
          </span>
          <div className="flex gap-2">
            {listado.page > 1 && (
              <Link
                href={`/admin/clientes?page=${listado.page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="rounded-lg border border-[#e2ddd6] px-3 py-1.5 font-semibold text-kora-black"
              >
                Anterior
              </Link>
            )}
            {listado.page < listado.totalPages && (
              <Link
                href={`/admin/clientes?page=${listado.page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="rounded-lg border border-[#e2ddd6] px-3 py-1.5 font-semibold text-kora-black"
              >
                Siguiente
              </Link>
            )}
          </div>
        </div>
      )}

      {verCliente && perfil && (
        <CustomerSheet
          customer={{
            id: verCliente.id,
            name: verCliente.name,
            phone: verCliente.phone,
            email: verCliente.email,
            country: verCliente.country,
            city: verCliente.city,
            address: verCliente.address,
            hasAccount: verCliente.passwordHash !== null,
          }}
          metrics={perfil.metrics}
          cashback={perfil.cashback}
          suscripcion={perfil.suscripcion}
          top={perfil.top}
          whatsapp={perfil.whatsapp}
          backTo={`/admin/clientes${q ? `?q=${encodeURIComponent(q)}` : ""}`}
        />
      )}

      {(nuevo || editarCliente) && (puedeCrear || puedeEditar) && (
        <CustomerForm
          customer={
            editarCliente
              ? {
                  id: editarCliente.id,
                  name: editarCliente.name,
                  phone: editarCliente.phone ?? "",
                  email: editarCliente.email ?? "",
                  document: editarCliente.document ?? "",
                  country: editarCliente.country,
                  city: editarCliente.city ?? "",
                  address: editarCliente.address ?? "",
                }
              : null
          }
          backTo={`/admin/clientes${q ? `?q=${encodeURIComponent(q)}` : ""}`}
        />
      )}
    </>
  );
}

export const metadata = { title: "Clientes" };
