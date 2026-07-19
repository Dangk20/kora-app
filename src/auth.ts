import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { checkPermission, PermissionError } from "@/modules/auth/permissions";
import { verifyCredentials } from "@/modules/auth/verify";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        return verifyCredentials(parsed.data.email, parsed.data.password);
      },
    }),
  ],
});

/**
 * Guard de permisos para Server Actions y rutas. Uso: await requirePermission("orders:confirm").
 * Verifica contra la BASE (no el JWT): desactivar un usuario o cambiarle el rol
 * surte efecto en su siguiente acción, no cuando expire la sesión.
 */
export async function requirePermission(permission: `${string}:${string}`) {
  const session = await auth();
  if (!session?.user) throw new PermissionError("UNAUTHENTICATED");
  await checkPermission(session.user.id, permission);
  return session;
}
