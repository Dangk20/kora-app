// Las secciones de la cuenta y cómo se leen de la URL.
//
// Módulo SIN "use client" a propósito: lo consumen las dos orillas. La página
// —que es un componente de servidor— necesita `seccionDe()` para decidir qué
// pintar, y la barra lateral —que es cliente— necesita la lista para dibujar
// las pestañas.
//
// Estaba dentro de `sidebar.tsx`, que sí es cliente, y la página lo importaba:
// Next lo rechaza en ejecución con "Attempted to call seccionDe() from the
// server but seccionDe is on the client". No lo detectó ninguna comprobación
// porque `/cuenta` sin sesión redirige a la pantalla de acceso, y comprobar
// que responde 307 no es comprobar que la página funciona.

import { Flame, Package, User } from "lucide-react";

export const SECCIONES = [
  { id: "pedidos", label: "Mis pedidos", icon: Package },
  { id: "cashback", label: "Kora Cashback", icon: Flame },
  { id: "datos", label: "Mis datos", icon: User },
] as const;

export type SeccionId = (typeof SECCIONES)[number]["id"];

export const SECCION_POR_DEFECTO: SeccionId = "pedidos";

/** Lee la sección de la URL, cayendo a la de por defecto si no se reconoce. */
export function seccionDe(valor: string | undefined): SeccionId {
  return SECCIONES.some((s) => s.id === valor) ? (valor as SeccionId) : SECCION_POR_DEFECTO;
}
