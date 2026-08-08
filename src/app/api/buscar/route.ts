// Sugerencias del buscador del header.
//
// Es un GET y no una Server Action a propósito: la acción es una lectura, se
// dispara con cada pulsación y no muta nada. Como Server Action iría por POST,
// arrastraría la revalidación del router en cada tecla y no se podría cachear.
//
// Devuelve SOLO producto publicado y el precio que resuelve `resolvePrice()`,
// el mismo de la ficha y el carrito.
import { NextResponse } from "next/server";
import { activeCurrency } from "@/modules/pricing/currency";
import { searchSuggestions } from "@/modules/storefront/search";

// La moneda activa vive en una cookie: sin esto, Next intentaría prerrenderizar
// la ruta y todos verían el precio del primero que buscó.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  const currency = await activeCurrency();
  const data = await searchSuggestions(q, currency);
  return NextResponse.json(data);
}
