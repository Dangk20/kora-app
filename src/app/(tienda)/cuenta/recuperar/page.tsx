// Recuperar la contraseña del comprador.
//
// Estuvo sin construir desde julio porque el dominio no podía enviar correo, y
// la pantalla de entrar decía "escríbenos por WhatsApp y te ayudamos". Eso era
// un apaño: obligaba a que una persona del negocio cambiara la contraseña de
// otra, que es exactamente lo que un sistema de cuentas debe evitar.
import { RecuperarForm } from "./recuperar-form";

export const metadata = {
  title: "Recuperar tu contraseña · KORA",
  // No se indexa: no aporta nada a la tienda y sí es un objetivo cómodo.
  robots: { index: false, follow: false },
};

export default function RecuperarPage() {
  return (
    <main className="mx-auto w-full max-w-[460px] px-5 py-14">
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Recuperar tu contraseña</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Te enviamos un código de 6 dígitos al correo de tu cuenta.
      </p>

      <div className="mt-7 rounded-[16px] border border-[#e2ddd6] bg-white p-5 sm:p-6">
        <RecuperarForm />
      </div>
    </main>
  );
}
