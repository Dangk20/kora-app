import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ProductForm } from "../product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("catalog:edit")) redirect("/admin/catalogo");
  const { id } = await params;

  const [product, categories] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { createdAt: "asc" } } },
    }),
    db.category.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Editar producto</h1>
      <ProductForm
        categories={categories}
        initial={{
          id: product.id,
          name: product.name,
          brand: product.brand ?? "",
          categoryId: product.categoryId,
          description: product.description ?? "",
          active: product.active,
          featured: product.featured,
          variants: product.variants
            .filter((v) => v.active)
            .map((v) => ({
              id: v.id,
              sku: v.sku,
              name: v.name,
              barcode: v.barcode ?? "",
              priceCopStore: String(v.priceCopStore),
              priceCopOnline: String(v.priceCopOnline),
              priceUsdStore: String(v.priceUsdStore),
              priceUsdOnline: String(v.priceUsdOnline),
              stockMin: String(v.stockMin),
              initialStock: "0",
              active: v.active,
              stockActual: v.stockActual,
            })),
        }}
      />
    </div>
  );
}
