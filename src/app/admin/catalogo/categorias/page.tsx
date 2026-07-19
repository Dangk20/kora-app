import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CategoriesTable } from "./categories-table";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("catalog:view")) redirect("/admin");

  const categories = await db.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { position: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/catalogo" aria-label="Volver al catálogo">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Categorías</h1>
      </div>
      <CategoriesTable
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          active: c.active,
          productCount: c._count.products,
        }))}
        canCreate={session.user.permissions.includes("catalog:create")}
        canEdit={session.user.permissions.includes("catalog:edit")}
        canDelete={session.user.permissions.includes("catalog:delete")}
      />
    </div>
  );
}
