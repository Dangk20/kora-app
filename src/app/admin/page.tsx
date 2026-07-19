import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("dashboard:view")) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Hola, {session?.user.name}</h1>
        <p className="text-sm text-muted-foreground">
          Tu módulo de trabajo estará disponible aquí cuando se active. Usa el menú
          de la izquierda.
        </p>
      </div>
    );
  }

  const [products, variants, stockUnits] = await Promise.all([
    db.product.count({ where: { active: true } }),
    db.variant.count({ where: { active: true } }),
    db.variant.aggregate({ _sum: { stockActual: true } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Productos activos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{products}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Variantes (SKU)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{variants}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unidades en stock
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {stockUnits._sum.stockActual ?? 0}
          </CardContent>
        </Card>
      </section>

      <p className="text-sm text-muted-foreground">
        Los informes de ventas llegan en la Semana 11; el catálogo, en la Semana 3.
      </p>
    </div>
  );
}
