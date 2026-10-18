// Cambio obligado de la contraseña temporal del registro rápido (ruleta).
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBuyer } from "@/modules/buyer/guard";
import { getMessages } from "@/modules/i18n/server";
import { fijarClave } from "../actions";
import { Marco } from "../marco";
import { NuevaClaveForm } from "./nueva-clave-form";

export async function generateMetadata() {
  return { title: (await getMessages()).cuenta.meta.nuevaClave };
}

export default async function NuevaClavePage() {
  const buyer = await requireBuyer("/cuenta/nueva-clave");
  const c = await db.customer.findUnique({ where: { id: buyer.customerId }, select: { mustChangePassword: true } });
  if (!c?.mustChangePassword) redirect("/cuenta");
  const t = (await getMessages()).cuenta.nuevaClave;
  return (
    <Marco titulo={t.titulo} bajada={t.bajada}>
      <NuevaClaveForm action={fijarClave} />
    </Marco>
  );
}
