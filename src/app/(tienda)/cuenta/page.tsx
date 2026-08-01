import Link from "next/link";
import { db } from "@/lib/db";
import { cashbackSummary } from "@/modules/cashback/balance";
import { requireBuyer } from "@/modules/buyer/guard";
import { buyerOrders } from "@/modules/buyer/orders";
import { CashbackPanel } from "./cashback-panel";
import { DatosForm, PasswordForm, SalirButton } from "./cuenta-forms";
import { EstadoPedido, money } from "./ui";

export const metadata = { title: "Mi cuenta · KORA" };

export default async function CuentaPage() {
  // Todo lo que sigue parte de la SESIÓN. Ningún identificador de la dirección
  // decide qué se muestra: esa es la diferencia entre que la cuenta sea privada
  // y que lo parezca.
  const buyer = await requireBuyer("/cuenta");

  const [resumen, pedidos, cliente] = await Promise.all([
    cashbackSummary(buyer.customerId),
    buyerOrders(buyer.customerId),
    db.customer.findUnique({
      where: { id: buyer.customerId },
      select: { name: true, email: true, phone: true, city: true, address: true },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[900px] px-5 py-10">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[30px] leading-tight font-extrabold tracking-tight text-kora-black">
            Hola, {buyer.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">{buyer.email}</p>
        </div>
        <SalirButton />
      </div>

      <CashbackPanel resumen={resumen} />

      <section className="mt-8">
        <h2 className="mb-3 text-[17px] font-extrabold text-kora-black">Mis pedidos</h2>

        {pedidos.length === 0 ? (
          <p className="rounded-[14px] border border-[#eee9e2] px-5 py-6 text-[14px] text-muted-foreground">
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
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#eee9e2] px-5 py-4 hover:border-[#ddd6cd]"
                >
                  <div>
                    <div className="text-[15px] font-bold text-kora-black">
                      Pedido {p.number}
                      <span className="ml-2 text-[12.5px] font-normal text-muted-foreground">
                        {p.items} artículo{p.items === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                      {new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(p.createdAt)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[15px] font-bold text-kora-black">
                      {money(p.total, p.currency)}
                    </div>
                    {p.cashback > 0 && (
                      <div className="text-[12px] text-muted-foreground">
                        {p.cashbackPendiente ? "Generará" : "Generó"} {money(p.cashback, p.currency)}{" "}
                        de cashback
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

      <section className="mt-9 grid gap-6 sm:grid-cols-2">
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
    </main>
  );
}
