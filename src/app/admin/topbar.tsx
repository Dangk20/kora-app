"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Tags } from "lucide-react";

// Título + subtítulo por vista, como la topbar del prototipo aprobado.
const VIEWS: { prefix: string; title: string; subtitle: string }[] = [
  { prefix: "/admin/catalogo/categorias", title: "Categorías y subcategorías", subtitle: "Organiza tu catálogo" },
  { prefix: "/admin/catalogo", title: "Productos", subtitle: "Tu catálogo, con variantes y 4 precios" },
  { prefix: "/admin/inventario", title: "Inventario unificado", subtitle: "Mismo stock para tienda online y física" },
  { prefix: "/admin/usuarios", title: "Usuarios", subtitle: "Roles y accesos del equipo" },
  { prefix: "/admin/clientes", title: "Módulo de clientes", subtitle: "Tu base de compradores" },
  { prefix: "/admin/pedidos", title: "Pedidos y envíos", subtitle: "Ventas online y su estado" },
  { prefix: "/admin", title: "Dashboard", subtitle: "Resumen de tu operación" },
];

export function Topbar({
  userName,
  permissions,
}: {
  userName: string;
  permissions: string[];
}) {
  const pathname = usePathname();
  const view = VIEWS.find((v) => pathname.startsWith(v.prefix)) ?? VIEWS[VIEWS.length - 1];
  const initial = (userName[0] ?? "K").toUpperCase();
  const isProducts = pathname === "/admin/catalogo";

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ece8e2] bg-white px-8 py-5">
      <div>
        <h1 className="text-[23px] leading-tight font-bold text-kora-black">{view.title}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{view.subtitle}</p>
      </div>
      <div className="flex items-center gap-3.5">
        {isProducts && permissions.includes("catalog:edit") && (
          <Link
            href="/admin/catalogo/categorias"
            className="flex items-center gap-2 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-kora-black hover:bg-muted"
          >
            <Tags className="size-4" /> Gestionar categorías
          </Link>
        )}
        {isProducts && permissions.includes("catalog:create") && (
          <Link
            href="/admin/catalogo?nuevo=1"
            className="bg-kora-gradient flex items-center gap-2 rounded-[11px] px-[18px] py-2.5 text-[13.5px] font-bold text-white shadow-[0_6px_16px_rgba(255,90,31,.3)] hover:opacity-90"
          >
            <Plus className="size-4" /> Nuevo producto
          </Link>
        )}
        <span
          className="bg-kora-gradient flex size-10 items-center justify-center rounded-full text-base font-extrabold text-white"
          title={userName}
        >
          {initial}
        </span>
      </div>
    </div>
  );
}
