import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
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

/** Guard de permisos para Server Actions y rutas. Uso: await requirePermission("orders:confirm") */
export async function requirePermission(permission: `${string}:${string}`) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  if (!session.user.permissions?.includes(permission)) {
    throw new Error(`FORBIDDEN:${permission}`);
  }
  return session;
}
