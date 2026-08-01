// Página pública de baja.
// Ver openspec/changes/email-marketing — specs/email-consent.
//
// UN CLIC Y LISTO: la baja ocurre al abrir el enlace, no tras confirmar. Una
// baja con fricción no evita la baja — la convierte en una queja de spam, que
// es mucho peor: la registra el proveedor de correo del destinatario y afecta a
// todos los envíos futuros del dominio. Facilitar la salida protege la entrada.
//
// Sin sesión a propósito: quien recibe un correo puede no tener cuenta, y
// pedirle que entre a una para dejar de recibirlo es exactamente la fricción
// que hay que evitar.

import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { resubscribe, unsubscribeByLink } from "@/modules/consent/subscription";
import { verifyUnsubscribeToken } from "@/modules/consent/token";

export const metadata = { title: "Suscripción · KORA" };
export const dynamic = "force-dynamic";

async function volverASuscribirse(formData: FormData) {
  "use server";
  const t = String(formData.get("t") ?? "");
  const customerId = verifyUnsubscribeToken(t);
  // Firma inválida: no se hace nada y no se dice si el cliente existe.
  if (customerId) await resubscribe(customerId);
  // Redirige con la marca puesta: sin ella, volver a pintar esta página vería
  // al cliente suscrito otra vez y lo daría de baja de inmediato — el gesto se
  // desharía solo.
  redirect(`/suscripcion/baja?t=${encodeURIComponent(t)}&re=1`);
}

export default async function BajaPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; re?: string }>;
}) {
  const { t = "", re } = await searchParams;
  const customerId = verifyUnsubscribeToken(t);

  // Un enlace manipulado no surte efecto y NO revela si el cliente existe: el
  // mensaje es el mismo que vería alguien con un enlace caducado o mal copiado.
  if (!customerId) {
    return (
      <Marco titulo="No pudimos procesar el enlace">
        <p className="text-[14.5px] leading-relaxed text-muted-foreground">
          El enlace no es válido o se copió incompleto. Si quieres dejar de recibir nuestros
          correos, escríbenos por WhatsApp y lo hacemos por ti.
        </p>
      </Marco>
    );
  }

  const cliente = await db.customer.findUnique({
    where: { id: customerId },
    select: { acceptsMarketing: true },
  });
  if (!cliente) {
    return (
      <Marco titulo="Listo">
        <p className="text-[14.5px] leading-relaxed text-muted-foreground">
          No volverás a recibir promociones de KORA.
        </p>
      </Marco>
    );
  }

  // El efecto ocurre AQUÍ, al abrir el enlace. Es una acción explícita del
  // destinatario: pulsó "Cancelar suscripción" en su correo.
  if (cliente.acceptsMarketing && !re) await unsubscribeByLink(customerId);

  const suscrito = re ? true : false;

  return (
    <Marco titulo={suscrito ? "Vuelves a estar suscrito" : "Listo, ya no recibirás promociones"}>
      {suscrito ? (
        <p className="text-[14.5px] leading-relaxed text-muted-foreground">
          Volverás a recibir nuestras ofertas y novedades. Puedes darte de baja cuando quieras
          desde cualquier correo.
        </p>
      ) : (
        <>
          <p className="text-[14.5px] leading-relaxed text-muted-foreground">
            No volverás a recibir promociones de KORA. Los mensajes sobre tus pedidos siguen
            llegando: no dependen de esta suscripción.
          </p>

          {/* La re-suscripción es la ÚNICA vía de reactivación, y solo por
              decisión del propio cliente: volver a comprar no re-suscribe. */}
          <form action={volverASuscribirse} className="mt-5">
            <input type="hidden" name="t" value={t} />
            <button
              type="submit"
              className="rounded-[10px] border-[1.6px] border-[#e2ddd6] px-4 py-2.5 text-[13.5px] font-semibold text-kora-black hover:border-[#ddd6cd]"
            >
              Me desuscribí sin querer, volver a suscribirme
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-[13px]">
        <Link href="/" className="font-semibold text-kora-black underline">
          Volver a la tienda
        </Link>
      </p>
    </Marco>
  );
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[560px] px-5 py-16">
      <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-kora-black">
        {titulo}
      </h1>
      <div className="mt-3">{children}</div>
    </main>
  );
}
