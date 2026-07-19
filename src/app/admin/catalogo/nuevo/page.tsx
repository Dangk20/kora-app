import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("catalog:create")) redirect("/admin/catalogo");

  const categories = await db.category.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo producto</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
