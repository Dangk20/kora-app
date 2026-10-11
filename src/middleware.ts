import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import { enrutarLegal } from "@/modules/legal/routing";

// Dos trabajos, en este orden:
//
// 1. El centro legal (change `centro-legal`): enrutado por host del
//    subdominio `legal.korashopp.com` y redirección de los enlaces antiguos
//    `/legal/<slug>`. La regla es pura y vive en `src/modules/legal/routing.ts`.
//
// 2. El panel: solo valida el JWT (la verificación de credenciales vive en
//    src/auth.ts), y SOLO en /admin y /pos, como antes.
//
// El comprador NO pasa por la parte 2, y ese es el diseño: su sesión vive en
// otra cookie (`kora_buyer`) y se verifica por otro camino contra la base.
// Para este middleware, un comprador es exactamente igual que alguien sin
// sesión — así, una ruta nueva bajo /admin queda protegida por omisión y no
// por acordarse de comprobar una marca en un token compartido.
// Ver openspec/changes/cuenta-comprador — design.md §1.
const { auth } = NextAuth(authConfig);
const authMiddleware = auth as unknown as (req: NextRequest, ev: NextFetchEvent) => Promise<Response | undefined>;

export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  const decision = enrutarLegal(req.headers.get("host"), req.nextUrl.pathname);

  if (decision.tipo === "redirigir") {
    // Next exige una URL absoluta. Detrás de Caddy la app ve `http://`; el
    // protocolo real lo dice `X-Forwarded-Proto`, que pone el borde. Sin él,
    // el visitante iría a la versión sin cifrar para que el borde lo rebotara.
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(":", "");
    const destino = /^https?:\/\//.test(decision.destino)
      ? decision.destino
      : `${proto}://${req.headers.get("host")}${decision.destino}`;
    return NextResponse.redirect(destino, 301);
  }
  if (decision.tipo === "reescribir") {
    const url = req.nextUrl.clone();
    url.pathname = decision.ruta;
    return NextResponse.rewrite(url);
  }

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") || pathname.startsWith("/pos")) {
    return authMiddleware(req, ev);
  }
  return NextResponse.next();
}

export const config = {
  // Todo menos los recursos de Next, las rutas de API y los archivos de
  // `/media`: el host legal se decide en cualquier ruta de página.
  matcher: ["/((?!_next/static|_next/image|api/|media/).*)"],
  // Runtime de Node (estable en Next 15.5): lee `KORA_LEGAL_URL` del proceso
  // al ejecutarse. En el runtime edge las variables pueden quedar fijadas al
  // compilar, y la imagen se compila UNA vez para pruebas y producción.
  runtime: "nodejs",
};
