import type { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: string;
    permissions: string[];
  }
  interface Session {
    user: {
      id: string;
      role: string;
      permissions: string[];
      /** `iat` del JWT, para cerrar sesiones anteriores a un cambio de contraseña. */
      issuedAt?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    permissions: string[];
  }
}
