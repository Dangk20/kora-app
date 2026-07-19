import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function logout() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AdminPage() {
  const session = await auth();
  const [products, variants, stockUnits] = await Promise.all([
    db.product.count({ where: { active: true } }),
    db.variant.count({ where: { active: true } }),
    db.variant.aggregate({ _sum: { stockActual: true } }),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Panel KORA</h1>
          <p className="text-sm text-muted-foreground">
            {session?.user.name} · <Badge variant="outline">{session?.user.role}</Badge>
          </p>
        </div>
        <form action={logout}>
          <Button variant="outline" type="submit">
            Salir
          </Button>
        </form>
      </header>

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
        Semana 2 en curso: gestión de usuarios y matriz de permisos por rol.
      </p>
    </main>
  );
}
