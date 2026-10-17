"use client";

// El logo de la caja abre el menú con lo que antes estaba a la derecha del
// encabezado (Panel y Tienda): la derecha queda para las acciones del turno.
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, Store } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MenuKora() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-kora-coral"
        aria-label="Menú"
      >
        <Image src="/logo-kora.png" alt="KORA" width={96} height={25} priority className="h-6 w-auto" />
        <span className="text-[10px] tracking-[1px] text-white/40">POS</span>
        <ChevronDown className="size-3.5 text-white/50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="min-w-[200px]">
        <DropdownMenuItem asChild>
          <Link href="/admin" className="flex items-center gap-2.5">
            <LayoutDashboard className="size-4" /> Panel
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/" className="flex items-center gap-2.5">
            <Store className="size-4" /> Tienda
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
