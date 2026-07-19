import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Solo valida el JWT (edge-safe); la verificación de credenciales vive en src/auth.ts.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/admin/:path*", "/pos/:path*"],
};
