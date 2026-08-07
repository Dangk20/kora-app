"use client";

// Error de la tienda: la red se cayó, la base no respondió, algo se rompió.
//
// Next exige que esto sea un componente cliente. Lo importante es qué NO hace:
// no muestra el mensaje técnico del error. A un comprador no le sirve leer
// "PrismaClientKnownRequestError" y a quien quiera atacar la tienda sí le
// sirve. El detalle va a la consola del servidor, donde se puede leer.
//
// Diseño móvil §08: "No pudimos cargar el catálogo. Revisa tu conexión e
// intenta de nuevo."

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function ErrorTienda({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El `digest` es el identificador que Next deja también en el registro del
    // servidor: es lo que permite cruzar lo que vio el comprador con la causa.
    console.error("[tienda]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center px-5 py-20 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-[#FFE9DD] text-kora-coral">
        <RefreshCw className="size-7" aria-hidden />
      </span>
      <h1 className="text-[20px] font-extrabold text-kora-black">
        No pudimos cargar esta página
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[#8a8f98]">
        Revisa tu conexión e intenta de nuevo. Si sigue pasando, escríbenos por
        WhatsApp y te ayudamos.
      </p>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="bg-kora-gradient flex min-h-12 items-center justify-center rounded-full px-7 text-[14px] font-bold text-white"
        >
          Intentar de nuevo
        </button>
        <Link
          href="/catalogo"
          className="flex min-h-12 items-center justify-center rounded-full border-[1.8px] border-kora-black bg-white px-7 text-[14px] font-bold text-kora-black"
        >
          Ir al catálogo
        </Link>
      </div>
    </div>
  );
}
