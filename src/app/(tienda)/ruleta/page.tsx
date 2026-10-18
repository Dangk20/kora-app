// La ruleta de la gran apertura: el QR de la tienda trae aquí.
// Ver openspec/changes/ruleta-apertura.
import { currentBuyer } from "@/modules/buyer/session-cookie";
import { activeLocale, getMessages } from "@/modules/i18n/server";
import { legalUrl } from "@/modules/legal/url";
import { PREMIOS, leerConfig } from "@/modules/ruleta/premios";
import { estadoRuleta } from "@/modules/ruleta/ruleta";
import { RuletaView } from "./ruleta-view";

// Depende de la sesión y de si KORA abrió la ruleta: nunca se cachea.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getMessages()).ruleta.meta, robots: { index: false } };
}

export default async function RuletaPage() {
  const [buyer, locale] = await Promise.all([currentBuyer(), activeLocale()]);
  const estado = buyer
    ? await estadoRuleta(buyer.customerId)
    : { activa: (await leerConfig()).activa, celular: null, giro: null };

  return (
    <RuletaView
      premios={PREMIOS.map(({ key, grande, chico, frase, kind, super: esSuper }) => ({
        key, grande, chico, frase, kind, super: Boolean(esSuper),
      }))}
      activa={estado.activa}
      conSesion={Boolean(buyer)}
      nombre={buyer?.name.split(/\s+/)[0] ?? null}
      tieneCelular={Boolean(estado.celular)}
      giro={estado.giro ? { ...estado.giro, vence: estado.giro.vence.toISOString() } : null}
      legal={{ datos: legalUrl(locale, "datos-personales"), terminos: legalUrl(locale, "terminos") }}
    />
  );
}
