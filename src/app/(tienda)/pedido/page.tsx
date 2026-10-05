// Seguimiento del pedido sin cuenta (alcance §1.9).
//
// El checkout permite comprar como invitado, así que tiene que haber una forma
// de consultar el pedido sin crear una. Ver `modules/orders/tracking.ts` para
// por qué hacen falta dos datos y no solo el número.
import Link from "next/link";
import { BuscarPedidoForm } from "./buscar-form";
import { getMessages } from "@/modules/i18n/server";

export async function generateMetadata() {
  const { pedido } = await getMessages();
  return { title: pedido.meta.seguimiento, description: pedido.meta.seguimientoDescripcion };
}

export default async function SeguimientoPage() {
  const ts = (await getMessages()).pedido.seguimiento;
  return (
    <main className="mx-auto w-full max-w-[560px] px-5 py-12">
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{ts.titulo}</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        {ts.bajada}
      </p>

      <div className="mt-7 rounded-[16px] border border-[#e2ddd6] bg-white p-5 sm:p-6">
        <BuscarPedidoForm />
      </div>

      <p className="mt-6 text-[13px] text-muted-foreground">
        {ts.tienesCuenta}{" "}
        <Link href="/cuenta/entrar" className="underline">
          {ts.entra}
        </Link>{" "}
        {ts.tienesCuentaResto}
      </p>
    </main>
  );
}
