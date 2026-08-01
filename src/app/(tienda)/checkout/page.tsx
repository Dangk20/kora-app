import type { Metadata } from "next";
import { activeCurrency } from "@/modules/pricing/currency";
import { currentBuyer } from "@/modules/buyer/session-cookie";
import { CheckoutView } from "./checkout-view";

// El layout raíz ya añade el sufijo "· KORA" (template de metadata).
export const metadata: Metadata = { title: "Finalizar pedido" };

export default async function CheckoutPage() {
  // La moneda define el país del formulario: COP → Colombia, USD → EE.UU.
  const [currency, buyer] = await Promise.all([activeCurrency(), currentBuyer()]);

  return (
    <CheckoutView
      initialCountry={currency === "COP" ? "CO" : "US"}
      buyer={
        buyer
          ? {
              name: buyer.name,
              email: buyer.email ?? "",
              // El formulario pide el número nacional; el prefijo lo pone él.
              phone: (buyer.phone ?? "").replace(/^\+(57|1)/, ""),
            }
          : null
      }
    />
  );
}
