import { db } from "@/lib/db";

export class PermissionError extends Error {
  constructor(
    public readonly reason: "UNAUTHENTICATED" | "INACTIVE" | "FORBIDDEN",
    permission?: string,
  ) {
    super(permission ? `${reason}:${permission}` : reason);
    this.name = "PermissionError";
  }
}

/**
 * Verifica un permiso contra la base (no contra el JWT): un usuario
 * desactivado o degradado pierde acceso en su siguiente acción, sin
 * esperar a que expire la sesión.
 */
export async function checkPermission(
  userId: string,
  permission: `${string}:${string}`,
): Promise<void> {
  const [module, action] = permission.split(":");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      active: true,
      role: {
        select: {
          permissions: {
            where: { permission: { module, action } },
            select: { permissionId: true },
          },
        },
      },
    },
  });
  if (!user) throw new PermissionError("UNAUTHENTICATED");
  if (!user.active) throw new PermissionError("INACTIVE");
  if (user.role.permissions.length === 0) {
    throw new PermissionError("FORBIDDEN", permission);
  }
}
