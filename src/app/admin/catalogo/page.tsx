import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Tags } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatCop = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

export default async function CatalogPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("catalog:view")) redirect("/admin");
  const canCreate = session.user.permissions.includes("catalog:create");
  const canEdit = session.user.permissions.includes("catalog:edit");

  const products = await db.product.findMany({
    include: {
      category: true,
      variants: { where: { active: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Catálogo</h1>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" className="rounded-full" asChild>
              <Link href="/admin/catalogo/categorias">
                <Tags className="size-4" /> Categorías
              </Link>
            </Button>
          )}
          {canCreate && (
            <Button variant="brand" asChild>
              <Link href="/admin/catalogo/nuevo">
                <Plus className="size-4" /> Nuevo producto
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Variantes</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Precio online (COP)</TableHead>
              <TableHead>Estado</TableHead>
              {canEdit && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const stock = p.variants.reduce((s, v) => s + v.stockActual, 0);
              const prices = p.variants.map((v) => Number(v.priceCopOnline));
              const min = prices.length ? Math.min(...prices) : 0;
              const max = prices.length ? Math.max(...prices) : 0;
              const lowStock = p.variants.some((v) => v.stockActual <= v.stockMin);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-medium">{p.name}</span>
                    {p.brand && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.brand}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{p.category.name}</TableCell>
                  <TableCell className="text-right">{p.variants.length}</TableCell>
                  <TableCell
                    className={`text-right ${lowStock ? "font-semibold text-destructive" : ""}`}
                  >
                    {stock}
                  </TableCell>
                  <TableCell className="text-right">
                    {min === max ? formatCop(min) : `${formatCop(min)} – ${formatCop(max)}`}
                  </TableCell>
                  <TableCell>
                    {p.active ? (
                      <Badge>Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/catalogo/${p.id}`}>Editar</Link>
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Aún no hay productos. Crea el primero.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
