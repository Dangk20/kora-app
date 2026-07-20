import type { Metadata } from "next";
import { CartView } from "./cart-view";

// El layout raíz ya añade el sufijo "· KORA" (template de metadata).
export const metadata: Metadata = { title: "Tu carrito" };

export default function CarritoPage() {
  return <CartView />;
}
