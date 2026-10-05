import { redirect } from "next/navigation";
import { currentBuyer } from "@/modules/buyer/session-cookie";
import { crearCuenta } from "../actions";
import { CrearForm } from "../auth-form";
import { Marco } from "../marco";
import { getMessages } from "@/modules/i18n/server";

export async function generateMetadata() {
  return { title: (await getMessages()).cuenta.meta.crear };
}

export default async function CrearPage() {
  if (await currentBuyer()) redirect("/cuenta");
  const t = (await getMessages()).cuenta;

  return (
    <Marco
      titulo={t.crear.titulo}
      bajada={t.crear.bajada}
    >
      <CrearForm action={crearCuenta} />
    </Marco>
  );
}
