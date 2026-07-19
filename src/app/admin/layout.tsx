import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  Users,
  UsersRound,
} from "lucide-react";
import { auth, signOut } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// La navegación se filtra con la misma matriz módulo:acción de la sesión.
// Los módulos de semanas futuras se agregan aquí a medida que existen.
const NAV = [
  { href: "/admin", label: "Dashboard", permission: "dashboard:view", icon: LayoutDashboard },
  { href: "/admin/catalogo", label: "Catálogo", permission: "catalog:view", icon: Package, soon: "S3" },
  { href: "/admin/pedidos", label: "Pedidos", permission: "orders:view", icon: ShoppingCart, soon: "S8" },
  { href: "/admin/clientes", label: "Clientes", permission: "crm:view", icon: UsersRound, soon: "S10" },
  { href: "/pos", label: "Punto de venta", permission: "pos:view", icon: Store, soon: "S9" },
  { href: "/admin/usuarios", label: "Usuarios", permission: "users:view", icon: Users },
] as const;

async function logout() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const permissions = session.user.permissions ?? [];
  const items = NAV.filter((item) => permissions.includes(item.permission));

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r bg-muted/30 p-4">
        <div className="px-2 py-1">
          <span className="text-xl font-bold tracking-tight">KORA</span>
          <p className="text-xs text-muted-foreground">Panel administrativo</p>
        </div>
        <Separator className="my-4" />
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ href, label, icon: Icon, ...item }) => (
            <Link
              key={href}
              href={"soon" in item ? "#" : href}
              aria-disabled={"soon" in item}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted ${
                "soon" in item ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <Icon className="size-4" />
              {label}
              {"soon" in item && (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {item.soon}
                </Badge>
              )}
            </Link>
          ))}
        </nav>
        <Separator className="my-4" />
        <div className="space-y-2 px-2">
          <p className="truncate text-sm">{session.user.name}</p>
          <Badge variant="secondary">{session.user.role}</Badge>
          <form action={logout}>
            <Button variant="outline" size="sm" className="w-full" type="submit">
              Salir
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
