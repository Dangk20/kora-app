import type { ReactNode } from "react";

/** Marco de las pantallas de acceso: tarjeta centrada sobre el fondo claro. */
export function Marco({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[440px] px-5 py-12">
      <h1 className="text-[30px] leading-tight font-extrabold tracking-tight text-kora-black">
        {titulo}
      </h1>
      <p className="mt-2 mb-7 text-[14px] text-muted-foreground">{bajada}</p>
      {children}
    </main>
  );
}
