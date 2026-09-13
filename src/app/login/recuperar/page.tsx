// Recuperar la contraseña del panel. La MISMA pantalla que la del comprador,
// con las acciones del panel: son dos identidades distintas por diseño, pero
// no hay razón para que el flujo se vea o se comporte distinto.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RecuperarForm } from "@/app/(tienda)/cuenta/recuperar/recuperar-form";
import { LARGO_MINIMO_ADMIN } from "@/modules/auth/reset";
import { confirmarCodigoPanel, pedirCodigoPanel } from "./actions";

export const metadata = {
  title: "Recuperar contraseña del panel · KORA",
  robots: { index: false, follow: false },
};

export default function RecuperarPanelPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col justify-center px-5 py-14">
      <Link href="/login" className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-kora-black">
        <ArrowLeft className="size-4" /> Volver a iniciar sesión
      </Link>
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Recuperar tu contraseña</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Te enviamos un código de 6 dígitos al correo de tu usuario del panel.
      </p>
      <div className="mt-7 rounded-[16px] border border-[#e2ddd6] bg-white p-5 sm:p-6">
        <RecuperarForm
          pedir={pedirCodigoPanel}
          confirmar={confirmarCodigoPanel}
          volverA="/login"
          minimoPassword={LARGO_MINIMO_ADMIN}
        />
      </div>
      <p className="mt-5 text-center text-[12px] text-muted-foreground">
        Al cambiarla se cierran todas las sesiones abiertas de este usuario.
      </p>
    </main>
  );
}
