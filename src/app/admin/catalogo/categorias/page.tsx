import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CategoryManager } from "./category-manager";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("catalog:view")) redirect("/admin");

  const categories = await db.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ position: "asc" }],
  });

  const parents = categories
    .filter((c) => !c.parentId)
    .map((parent) => {
      const children = categories
        .filter((c) => c.parentId === parent.id)
        .map((child) => ({
          id: child.id,
          name: child.name,
          icon: child.icon,
          productCount: child._count.products,
        }));
      return {
        id: parent.id,
        name: parent.name,
        color: parent.color,
        icon: parent.icon,
        // Los productos viven casi siempre en la SUBCATEGORÍA (así los asigna
        // el importador): contar solo los directos dejaba "0 productos" en
        // todas las líneas (4 oct 2026).
        productCount:
          parent._count.products + children.reduce((sum, c) => sum + c.productCount, 0),
        // Para el borrado: solo los directos bloquean borrar el padre.
        directCount: parent._count.products,
        children,
      };
    });

  return (
    <CategoryManager
      parents={parents}
      canCreate={session.user.permissions.includes("catalog:create")}
      canEdit={session.user.permissions.includes("catalog:edit")}
      canDelete={session.user.permissions.includes("catalog:delete")}
    />
  );
}
