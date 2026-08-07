"use client";

// Une el header móvil con su menú lateral: el botón "Menú" vive en el header y
// el panel se abre por encima de todo, así que necesitan compartir estado.
//
// Es lo único que este componente hace. La lógica de cada pieza vive en su
// archivo; aquí solo está el `useState` que los dos necesitan.

import { useState } from "react";
import type { Currency } from "@/modules/pricing";
import type { StoreCategory } from "../queries";
import { MobileHeader } from "./mobile-chrome";
import { MobileMenu } from "./mobile-menu";

export function MobileShell({
  currency,
  categories,
  whatsappHref,
}: {
  currency: Currency;
  categories: StoreCategory[];
  whatsappHref: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <MobileHeader currency={currency} onOpenMenu={() => setMenuOpen(true)} />
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        categories={categories}
        whatsappHref={whatsappHref}
      />
    </>
  );
}
