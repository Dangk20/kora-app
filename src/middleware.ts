import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Solo valida el JWT (edge-safe); la verificación de credenciales vive en src/auth.ts.
//
// El comprador NO pasa por aquí, y ese es el diseño: su sesión vive en otra
// cookie (`kora_buyer`) y se verifica por otro camino contra la base. Para este
// middleware, un comprador es exactamente igual que alguien sin sesión — así,
// una ruta nueva bajo /admin queda protegida por omisión y no por acordarse de
// comprobar una marca en un token compartido.
// Ver openspec/changes/cuenta-comprador — design.md §1.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/admin/:path*", "/pos/:path*"],
};
