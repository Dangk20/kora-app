import type { Metadata } from "next";
import { activeCurrency } from "@/modules/pricing/currency";
import { CheckoutView } from "./checkout-view";

// El layout raíz ya añade el sufijo "· KORA" (template de metadata).
export const metadata: Metadata = { title: "Finalizar pedido" };

export default async function CheckoutPage() {
  // La moneda define el país del formulario: COP → Colombia, USD → EE.UU.
  const currency = await activeCurrency();
  return <CheckoutView initialCountry={currency === "COP" ? "CO" : "US"} />;
}
