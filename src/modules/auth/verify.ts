import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[]; // "modulo:accion"
};

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  if (!user || !user.active) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    permissions: user.role.permissions.map(
      (rp) => `${rp.permission.module}:${rp.permission.action}`,
    ),
  };
}
