import Link from "next/link";
import { db } from "@/lib/db";
import { cashbackSummary } from "@/modules/cashback/balance";
import { requireBuyer } from "@/modules/buyer/guard";
import { buyerOrders } from "@/modules/buyer/orders";
import { formatOrderNumber } from "@/modules/orders/message";
import { CashbackPanel } from "./cashback-panel";
import { DatosForm, PasswordForm, SalirButton } from "./cuenta-forms";
import { CuentaSidebar } from "./sidebar";
import { CuentaMovil } from "./cuenta-movil";
import { seccionDe } from "./secciones";
import { EstadoPedido, money } from "./ui";

export const metadata = { title: "Mi cuenta · KORA" };

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>;
}) {
  // Todo lo que sigue parte de la SESIÓN. Ningún identificador de la dirección
  // decide qué se muestra: esa es la diferencia entre que la cuenta sea privada
  // y que lo parezca.
  const buyer = await requireBuyer("/cuenta");
  const seccion = seccionDe((await searchParams).seccion);

  const [resumen, pedidos, cliente] = await Promise.all([
    cashbackSummary(buyer.customerId),
    buyerOrders(buyer.customerId),
    db.customer.findUnique({
      where: { id: buyer.customerId },
      select: { name: true, email: true, phone: true, city: true, address: true },
    }),
  ]);

  return (
    <main>
      {/* Dos diseños distintos, no uno degradado: el móvil apila franja de
          usuario, saldo y pedidos (diseño móvil §07); el de escritorio conserva
          la barra lateral con pestañas del prototipo (§7). */}
      <CuentaMovil
        nombre={buyer.name}
        email={buyer.email ?? ""}
        resumen={resumen}
        pedidos={pedidos}
        salir={<SalirButton compacto />}
        datos={
          <div className="space-y-6">
            <DatosForm
              defaults={{
                name: cliente?.name ?? buyer.name,
                phone: cliente?.phone ?? "",
                city: cliente?.city ?? "",
                address: cliente?.address ?? "",
              }}
            />
            <div>
              <h3 className="mb-3 text-[14px] font-extrabold text-kora-black">Contraseña</h3>
              <PasswordForm />
            </div>
          </div>
        }
      />

      <div className="mx-auto hidden w-full max-w-[1100px] px-5 py-8 lg:block lg:py-10">
      <h1 className="mb-6 text-[26px] leading-tight font-extrabold tracking-tight text-kora-black lg:text-[30px]">
        Hola, {buyer.name.split(" ")[0]}
      </h1>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-7">
        <CuentaSidebar
          nombre={buyer.name}
          email={buyer.email ?? ""}
          salir={<SalirButton />}
        />

        <div className="min-w-0 flex-1">
          {seccion === "pedidos" && (
            <section aria-label="Mis pedidos">
              <h2 className="mb-3 text-[17px] font-extrabold text-kora-black">Mis pedidos</h2>

              {pedidos.length === 0 ? (
                <p className="rounded-[14px] border border-[#eee9e2] bg-white px-5 py-6 text-[14px] text-muted-foreground">
                  Todavía no has hecho ningún pedido.{" "}
                  <Link href="/catalogo" className="font-semibold text-kora-black underline">
                    Ver el catálogo
                  </Link>
                </p>
              ) : (
                <ul className="grid gap-2.5">
                  {pedidos.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/cuenta/pedidos/${p.number}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#eee9e2] bg-white px-5 py-4 hover:border-[#ddd6cd]"
                      >
                        <div>
                          <div className="text-[15px] font-bold text-kora-black">
                            {/* El código humano, NO el autoincremento. El pedido
                                se confirma y se paga por WhatsApp: este número
                                es como el operador lo encuentra, y "Pedido 2"
                                no lo encuentra nadie. */}
                            {formatOrderNumber(p.number, p.createdAt)}
                            <span className="ml-2 text-[12.5px] font-normal text-muted-foreground">
                              {p.items} artículo{p.items === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                            {new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(
                              p.createdAt,
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[15px] font-bold text-kora-black">
                            {money(p.total, p.currency)}
                          </div>
                          {p.cashback > 0 && (
                            <div className="text-[12px] text-muted-foreground">
                              {p.cashbackPendiente ? "Generará" : "Generó"}{" "}
                              {money(p.cashback, p.currency)} de cashback
                            </div>
                          )}
                        </div>

                        <EstadoPedido status={p.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {seccion === "cashback" && (
            <section aria-label="Kora Cashback">
              <h2 className="mb-3 text-[17px] font-extrabold text-kora-black">Kora Cashback</h2>
              <CashbackPanel resumen={resumen} />
            </section>
          )}

          {seccion === "datos" && (
            <section aria-label="Mis datos" className="grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="mb-3 text-[17px] font-extrabold text-kora-black">Mis datos</h2>
                <DatosForm
                  defaults={{
                    name: cliente?.name ?? buyer.name,
                    phone: cliente?.phone ?? "",
                    city: cliente?.city ?? "",
                    address: cliente?.address ?? "",
                  }}
                />
              </div>
              <div>
                <h2 className="mb-3 text-[17px] font-extrabold text-kora-black">Contraseña</h2>
                <PasswordForm />
              </div>
            </section>
          )}
        </div>
      </div>
      </div>
    </main>
  );
}
