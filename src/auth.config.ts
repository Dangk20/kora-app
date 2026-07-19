import type { NextAuthConfig } from "next-auth";

// Configuración sin dependencias de Node (Prisma/bcrypt) para poder
// importarse desde el middleware. Los providers se agregan en src/auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const protectedArea =
        pathname.startsWith("/admin") || pathname.startsWith("/pos");
      if (!protectedArea) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.permissions = user.permissions;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role;
      session.user.permissions = token.permissions;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
