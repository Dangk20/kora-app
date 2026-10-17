import type { Metadata } from "next";
import { auth } from "@/auth";
import { listPosCatalog } from "@/modules/pos/catalog";
import { POS_PAYMENT_METHODS } from "@/modules/pos/sale";
import { baseDejada, turnoAbierto } from "@/modules/pos/turno";
import { PosView } from "./pos-view";
import { AperturaCaja } from "./turno-ui";

export const metadata: Metadata = { title: "Caja" };
// El stock y el turno cambian con cada venta: nada de caché.
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const [session, turno] = await Promise.all([auth(), turnoAbierto()]);

  // Sin turno abierto, la caja es una sola pregunta: ¿abrir el día?
  if (!turno) {
    return <AperturaCaja baseAnterior={await baseDejada()} cajero={session?.user.name ?? ""} />;
  }

  const catalog = await listPosCatalog();
  return (
    <PosView
      products={catalog.products}
      categories={catalog.categories}
      methods={[...POS_PAYMENT_METHODS]}
      canSell={Boolean(session?.user.permissions?.includes("pos:sell"))}
    />
  );
}
