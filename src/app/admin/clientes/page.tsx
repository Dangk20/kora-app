import { redirect } from "next/navigation";
import { ACTION_ICON } from "../_components/action-icon";
import Link from "next/link";
import { Eye, Pencil, Plus, Search, UsersRound } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cashbackSummary } from "@/modules/cashback/balance";
import { beneficiosDe } from "@/modules/benefits/benefits";
import { subscriptionState } from "@/modules/consent/subscription";
import { customerMetrics, topCategories, whatsappLink } from "@/modules/customers/profile";
import { customerSummary, listCustomers, PAGE_SIZE } from "@/modules/customers/queries";
import { FILTROS_CUENTA, ORIGEN_LABEL, parseFiltroCuenta } from "@/modules/customers/cuenta";
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

// Con cuenta en el naranja de marca, sin cuenta en el gris neutro. Solo paleta
// de marca.
const CUENTA_STYLE = {
  con: "bg-[#FFE9DD] text-[#FF5A1F]",
  sin: "bg-[#f0ece6] text-[#6b6f78]",
};

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
  searchParams: Promise<{
    q?: string;
    page?: string;
    ver?: string;
    nuevo?: string;
    editar?: string;
    cuenta?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("customers:view")) redirect("/admin");
  const puedeCrear = session.user.permissions.includes("customers:create");
  const puedeEditar = session.user.permissions.includes("customers:edit");
  const puedeOtorgar = session.user.permissions.includes("loyalty:adjust");

  const { q = "", page = "1", ver, nuevo, editar, cuenta: cuentaParam } = await searchParams;
  const pagina = Math.max(1, Number(page) || 1);
  const cuenta = parseFiltroCuenta(cuentaParam);

  const [resumen, listado] = await Promise.all([
    customerSummary(),
    listCustomers({ search: q, page: pagina, pageSize: PAGE_SIZE, cuenta }),
  ]);

  // Toda navegación de la vista conserva búsqueda y filtro.
  const href = (extra: Record<string, string> = {}, filtro: string = cuenta) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (filtro !== "todos") p.set("cuenta", filtro);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    const s = p.toString();
    return `/admin/clientes${s ? `?${s}` : ""}`;
  };

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
        beneficios: await beneficiosDe(verCliente.id),
        opcionesBeneficio: puedeOtorgar ? await opcionesBeneficio() : null,
      }
    : null;

  return (
    <>
      {/* Tres cifras (Daniel, 17 oct 2026): todos son clientes, y lo que se
          distingue es si tienen cuenta en la tienda. Si compraron o no se ve
          en la ficha de cada uno. */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Resumen label="Total de registros" hint="web, caja, importados o a mano" value={resumen.total} />
        <Resumen label="Clientes con cuenta" hint="pueden entrar a la tienda" value={resumen.conCuenta} />
        <Resumen label="Clientes sin cuenta" hint="invitados, de caja o a mano" value={resumen.sinCuenta} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-extrabold text-kora-black">Clientes</h1>
        <form className="ml-auto flex items-center gap-2" action="/admin/clientes">
          {cuenta !== "todos" && <input type="hidden" name="cuenta" value={cuenta} />}
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
              href={href({ nuevo: "1" })}
              className="bg-kora-gradient inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="size-4" /> Crear cliente
            </Link>
          )}
        </form>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS_CUENTA.map((f) => {
          const activo = cuenta === f.key;
          return (
            <Link
              key={f.key}
              href={href({}, f.key)}
              aria-current={activo ? "page" : undefined}
              className={
                activo
                  ? "bg-kora-gradient rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white"
                  : "rounded-full border border-[#e2ddd6] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#6b6f78]"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#eee9e2] bg-white">
        {listado.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <UsersRound className="mx-auto mb-3 size-9 text-[#cfd3d9]" />
            <p className="font-semibold text-kora-black">
              {q
                ? "Nadie coincide con la búsqueda"
                : cuenta === "con_cuenta"
                  ? "Todavía nadie ha creado cuenta en la tienda"
                  : cuenta === "sin_cuenta"
                    ? "Todos los clientes tienen cuenta"
                    : "Todavía no hay clientes en la base"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {q
                ? "Prueba con otro nombre, número o correo."
                : "Se crean solos al registrarse o comprar en la tienda o en la caja, o puedes añadirlos a mano."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[#f0ece6] bg-[#fbfaf8] text-left text-[12px] tracking-wide text-[#6b6f78] uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="px-5 py-3 font-semibold">Cuenta</th>
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
                      <div className="min-w-0">
                        <div className="font-semibold text-kora-black">{c.name}</div>
                        <div className="text-[11.5px] text-[#9aa0ab]">{ORIGEN_LABEL[c.source]}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${c.tieneCuenta ? CUENTA_STYLE.con : CUENTA_STYLE.sin}`}
                    >
                      {c.tieneCuenta ? "Con cuenta" : "Sin cuenta"}
                    </span>
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
                        href={href({ ver: c.id })}
                        aria-label={`Ver ${c.name}`}
                        className={ACTION_ICON}
                      >
                        <Eye className="size-4" />
                      </Link>
                      {puedeEditar && (
                        <Link
                          href={href({ editar: c.id })}
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
            {listado.total} persona{listado.total === 1 ? "" : "s"} · página {listado.page} de{" "}
            {listado.totalPages}
          </span>
          <div className="flex gap-2">
            {listado.page > 1 && (
              <Link
                href={href({ page: String(listado.page - 1) })}
                className="rounded-lg border border-[#e2ddd6] px-3 py-1.5 font-semibold text-kora-black"
              >
                Anterior
              </Link>
            )}
            {listado.page < listado.totalPages && (
              <Link
                href={href({ page: String(listado.page + 1) })}
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
          backTo={href()}
          beneficios={perfil.beneficios}
          opcionesBeneficio={perfil.opcionesBeneficio}
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
          backTo={href()}
        />
      )}
    </>
  );
}

export const metadata = { title: "Clientes" };

/** Categorías y productos activos para el formulario de "Otorgar beneficio". */
async function opcionesBeneficio() {
  const [categorias, variantes] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.variant.findMany({
      where: { active: true, product: { active: true, archivedAt: null } },
      orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, product: { select: { name: true } } },
    }),
  ]);
  return {
    categorias,
    productos: variantes.map((v) => ({
      id: v.id,
      label: /^[úu]nica$/i.test(v.name) ? v.product.name : `${v.product.name} · ${v.name}`,
    })),
  };
}
