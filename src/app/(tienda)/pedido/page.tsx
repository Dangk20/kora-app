// Seguimiento del pedido sin cuenta (alcance §1.9).
//
// El checkout permite comprar como invitado, así que tiene que haber una forma
// de consultar el pedido sin crear una. Ver `modules/orders/tracking.ts` para
// por qué hacen falta dos datos y no solo el número.
import Link from "next/link";
import { BuscarPedidoForm } from "./buscar-form";

export const metadata = {
  title: "Seguimiento de tu pedido · KORA",
  description: "Consulta el estado de tu pedido de KORA con su número y tu correo o celular.",
};

export default function SeguimientoPage() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-5 py-12">
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Seguimiento de tu pedido</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Escribe el número que te dimos al comprar y el correo o celular que usaste. No necesitas
        crear una cuenta.
      </p>

      <div className="mt-7 rounded-[16px] border border-[#e2ddd6] bg-white p-5 sm:p-6">
        <BuscarPedidoForm />
      </div>

      <p className="mt-6 text-[13px] text-muted-foreground">
        ¿Tienes cuenta?{" "}
        <Link href="/cuenta/entrar" className="underline">
          Entra
        </Link>{" "}
        y verás todos tus pedidos y tu saldo de Kora Cashback.
      </p>
    </main>
  );
}
