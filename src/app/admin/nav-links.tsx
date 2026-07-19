"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// La navegación se filtra con la misma matriz módulo:acción de la sesión.
// Los módulos de semanas futuras se agregan aquí a medida que existen.
type NavItem = {
  href: string;
  label: string;
  permission: string;
  icon: LucideIcon;
  soon?: string;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", permission: "dashboard:view", icon: LayoutDashboard },
  { href: "/admin/catalogo", label: "Productos", permission: "catalog:view", icon: Package },
  { href: "/admin/pedidos", label: "Pedidos", permission: "orders:view", icon: ShoppingCart, soon: "S8" },
  { href: "/admin/clientes", label: "Clientes", permission: "crm:view", icon: UsersRound, soon: "S10" },
  { href: "/pos", label: "Punto de venta", permission: "pos:view", icon: Store, soon: "S9" },
  { href: "/admin/usuarios", label: "Usuarios", permission: "users:view", icon: Users },
];

export function NavLinks({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => permissions.includes(item.permission));

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map(({ href, label, icon: Icon, soon }) => {
        const active = soon
          ? false
          : href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={soon ? "#" : href}
            aria-disabled={Boolean(soon)}
            className={cn(
              "flex items-center gap-3 rounded-[11px] px-3.5 py-3 text-sm font-semibold transition-colors",
              active
                ? "bg-kora-coral/15 text-kora-coral"
                : "text-[#A0A4AD] hover:bg-white/5 hover:text-white",
              soon && "pointer-events-none opacity-40",
            )}
          >
            <Icon className="size-[19px]" strokeWidth={1.8} />
            {label}
            {soon && (
              <Badge
                variant="outline"
                className="ml-auto border-white/25 text-[10px] text-white/60"
              >
                {soon}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
