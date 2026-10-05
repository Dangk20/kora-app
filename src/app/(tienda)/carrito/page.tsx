import type { Metadata } from "next";
import { getMessages } from "@/modules/i18n/server";
import { CartView } from "./cart-view";

// El layout raíz ya añade el sufijo "· KORA" (template de metadata).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.carrito.tituloPagina };
}

export default function CarritoPage() {
  return <CartView />;
}
