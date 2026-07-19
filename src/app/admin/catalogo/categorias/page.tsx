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
    .map((parent) => ({
      id: parent.id,
      name: parent.name,
      color: parent.color,
      icon: parent.icon,
      productCount: parent._count.products,
      children: categories
        .filter((c) => c.parentId === parent.id)
        .map((child) => ({
          id: child.id,
          name: child.name,
          productCount: child._count.products,
        })),
    }));

  return (
    <CategoryManager
      parents={parents}
      canCreate={session.user.permissions.includes("catalog:create")}
      canEdit={session.user.permissions.includes("catalog:edit")}
      canDelete={session.user.permissions.includes("catalog:delete")}
    />
  );
}
