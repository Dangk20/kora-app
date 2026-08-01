import { redirect } from "next/navigation";
import { currentBuyer } from "@/modules/buyer/session-cookie";
import { entrar } from "../actions";
import { EntrarForm } from "../auth-form";
import { Marco } from "../marco";

export const metadata = { title: "Entrar a mi cuenta · KORA" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;
  if (await currentBuyer()) redirect(volver?.startsWith("/") ? volver : "/cuenta");

  return (
    <Marco
      titulo="Entrar a mi cuenta"
      bajada="Consulta tu Kora Cashback, tus pedidos y tus datos."
    >
      <EntrarForm action={entrar} volver={volver} />
    </Marco>
  );
}
