import { redirect } from "next/navigation";
import { currentBuyer } from "@/modules/buyer/session-cookie";
import { crearCuenta } from "../actions";
import { CrearForm } from "../auth-form";
import { Marco } from "../marco";

export const metadata = { title: "Crear mi cuenta · KORA" };

export default async function CrearPage() {
  if (await currentBuyer()) redirect("/cuenta");

  return (
    <Marco
      titulo="Crear mi cuenta"
      bajada="Guarda tus pedidos y sigue tu Kora Cashback: el 3 % de lo que pagas vuelve a ti."
    >
      <CrearForm action={crearCuenta} />
    </Marco>
  );
}
