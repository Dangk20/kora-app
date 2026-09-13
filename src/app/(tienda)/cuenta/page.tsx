import Link from "next/link";
import { db } from "@/lib/db";
import { cashbackSummary } from "@/modules/cashback/balance";
import { requireBuyer } from "@/modules/buyer/guard";
import { buyerOrders } from "@/modules/buyer/orders";
import { PedidoCard } from "./pedido-card";
import { CashbackPanel } from "./cashback-panel";
import { DatosForm, PasswordForm, SalirButton } from "./cuenta-forms";
import { CuentaSidebar } from "./sidebar";
import { CuentaMovil } from "./cuenta-movil";
import { seccionDe } from "./secciones";
import { Direcciones } from "./direcciones";
import { listAddresses } from "@/modules/customers/addresses";

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

  const [resumen, pedidos, cliente, direcciones] = await Promise.all([
    cashbackSummary(buyer.customerId),
    buyerOrders(buyer.customerId),
    db.customer.findUnique({
      where: { id: buyer.customerId },
      select: { name: true, email: true, phone: true },
    }),
    listAddresses(buyer.customerId),
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
          <div className="space-y-4">
            {/* Sin encabezados fuera: cada tarjeta lleva su propio título y su
                botón de editar, así que un <h3> encima los duplicaba. */}
            <DatosForm
              defaults={{
                name: cliente?.name ?? buyer.name,
                email: buyer.email ?? "",
                phone: cliente?.phone ?? "",
              }}
            />
            <PasswordForm />
            <div className="pt-2">
              <h3 className="mb-3 text-[15px] font-extrabold text-kora-black">Mis direcciones</h3>
              <Direcciones direcciones={direcciones} />
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
                <ul className="grid gap-3">
                  {pedidos.map((p) => (
                    <li key={p.id}><PedidoCard p={p} /></li>
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

          {seccion === "direcciones" && (
            <section aria-label="Mis direcciones" className="space-y-4">
              <h2 className="text-[17px] font-extrabold text-kora-black">Mis direcciones</h2>
              <Direcciones direcciones={direcciones} />
            </section>
          )}

          {seccion === "datos" && (
            <section aria-label="Mis datos" className="space-y-4">
              <h2 className="text-[17px] font-extrabold text-kora-black">Mis datos</h2>
              <DatosForm
                defaults={{
                  name: cliente?.name ?? buyer.name,
                  email: buyer.email ?? "",
                  phone: cliente?.phone ?? "",
                }}
              />
              <PasswordForm />
            </section>
          )}
        </div>
      </div>
      </div>
    </main>
  );
}
