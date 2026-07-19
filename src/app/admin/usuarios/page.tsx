import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("users:view")) redirect("/admin");

  const [users, roles] = await Promise.all([
    db.user.findMany({
      include: { role: true },
      orderBy: { createdAt: "asc" },
    }),
    db.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Usuarios</h1>
      <UsersTable
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          roleId: u.roleId,
          roleName: u.role.name,
          active: u.active,
          createdAt: u.createdAt.toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        }))}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        currentUserId={session.user.id}
        canCreate={session.user.permissions.includes("users:create")}
        canEdit={session.user.permissions.includes("users:edit")}
      />
    </div>
  );
}
