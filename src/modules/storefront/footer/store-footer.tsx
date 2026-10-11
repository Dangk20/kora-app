// Footer de la tienda pública (change `centro-legal`, 10 oct 2026).
//
// Se aparta a propósito del footer del prototipo aprobado (una franja con
// logotipo y tres enlaces): Bank of America exige que el SITIO —no solo un
// documento— muestre las marcas aceptadas, el contacto y la dirección física
// y el país del comercio. Referencias de Daniel: los footers de Claro (franja
// de identificación) y de Seguros Mundial (bloque de medios de pago).
//
// Fondo y grises son los del footer anterior y del prototipo.
//
// Ningún dato de las sociedades va escrito aquí: salen de `merchant()`, la
// misma fuente que el centro legal y el comprobante. Cambiar una dirección es
// cambiar una variable de entorno, y el footer y las políticas cambian juntos.

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Mail, MessageCircle } from "lucide-react";
import type { Locale } from "@/modules/i18n";
import { MESSAGES } from "@/modules/i18n/messages";
import { merchant } from "@/modules/legal/config";
import { medicionActiva } from "@/modules/measurement/config";
import { CookiePreferencesLink } from "@/modules/measurement/tags";
import { allLegalDocuments } from "@/modules/legal/content";
import { MARCAS_ACEPTADAS, MEDIOS_TRANSFERENCIA } from "@/modules/legal/payments";
import { legalUrl } from "@/modules/legal/url";
import type { StoreCategory } from "../queries";
import { redesSociales } from "./social";

type Props = {
  locale: Locale;
  categories: StoreCategory[];
  whatsapp: { display: string; href: string };
};

type Enlace = { href: string; label: string; externo?: boolean };

/**
 * Logotipos de un grupo de medios de pago. Pastilla blanca: se muestran a
 * todo color y sin alterar (estándares de marca), y sobre el fondo oscuro sus
 * colores se perderían. Sin logotipo oficial todavía, va el nombre en texto.
 */
function Logos({ titulo, medios }: { titulo: string; medios: readonly { id: string; nombre: string; logo: string | null }[] }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="text-[12.5px]">{titulo}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {medios.map((m) => (
          <li key={m.id} className="flex h-[42px] items-center rounded-[7px] bg-white p-[3px]">
            {m.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- SVG estático; los estándares de marca prohíben alterarlo
              <img src={m.logo} alt={m.nombre} width={56} height={36} className="h-9 w-auto max-w-[96px] rounded-[5px] object-contain" />
            ) : (
              <span className="px-2.5 text-[14px] font-extrabold text-kora-black">{m.nombre}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Columna de enlaces: lista abierta en escritorio, acordeón en móvil. */
function Columna({
  titulo,
  enlaces,
  extra,
}: {
  titulo: string;
  enlaces: Enlace[];
  /** Un elemento que no es enlace (p. ej. el botón de preferencias de cookies). */
  extra?: React.ReactNode;
}) {
  const lista = (
    <ul className="space-y-2.5 text-[13.5px]">
      {enlaces.map((e) => (
        <li key={e.href}>
          {e.externo ? (
            <a href={e.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              {e.label}
            </a>
          ) : (
            <Link href={e.href} className="hover:text-white">
              {e.label}
            </Link>
          )}
        </li>
      ))}
      {extra && <li>{extra}</li>}
    </ul>
  );

  return (
    <div className="min-w-0">
      <details className="group border-b border-[#22252b] md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-[14px] font-bold text-white [&::-webkit-details-marker]:hidden">
          {titulo}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="pb-4">{lista}</div>
      </details>
      <div className="hidden md:block">
        <p className="mb-4 text-[14px] font-bold text-white">{titulo}</p>
        {lista}
      </div>
    </div>
  );
}

export function StoreFooter({ locale, categories, whatsapp }: Props) {
  const t = MESSAGES[locale];
  const f = t.layout.footer;
  const m = merchant();
  const docs = allLegalDocuments(m, locale);
  const redes = redesSociales();
  const doc = (slug: (typeof docs)[number]["slug"]) => docs.find((d) => d.slug === slug)!;

  const tienda: Enlace[] = [
    { href: "/catalogo", label: f.catalogo },
    ...categories.slice(0, 6).map((c) => ({ href: `/catalogo?categoria=${c.slug}`, label: c.name })),
  ];
  const ayuda: Enlace[] = [
    { href: whatsapp.href, label: t.layout.escribenosWhatsapp, externo: true },
    // Quien lo busca está buscando su pedido, no un documento legal. Es la
    // única vía para quien compró como invitado.
    { href: "/pedido", label: t.layout.seguimientoPedido },
    { href: "/cuenta", label: t.layout.miCuenta },
    { href: legalUrl(locale, "envios"), label: doc("envios").shortTitle },
    { href: legalUrl(locale, "cambios"), label: doc("cambios").shortTitle },
    { href: "/login", label: t.layout.accesoEquipo },
  ];
  const legal: Enlace[] = [
    { href: legalUrl(locale), label: f.centroLegal },
    ...docs.map((d) => ({ href: legalUrl(locale, d.slug), label: d.shortTitle })),
  ];

  return (
    <footer className="bg-[#0E0F12] px-[22px] pt-10 pb-8 text-[#A0A4AD] md:pt-14">
      <div className="mx-auto grid max-w-[1320px] gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1fr_1.35fr]">
        <div className="min-w-0">
          <Image src="/logo-kora.png" alt="KORA" width={160} height={42} className="h-9 w-auto" />
          <p className="mt-3 max-w-[260px] text-[13.5px] leading-relaxed">{t.layout.lema}</p>
        </div>

        <Columna titulo={f.tienda} enlaces={tienda} />
        <Columna titulo={f.ayuda} enlaces={ayuda} />
        <Columna
          titulo={f.legal}
          enlaces={legal}
          extra={
            medicionActiva() ? (
              <CookiePreferencesLink className="text-left hover:text-white" />
            ) : undefined
          }
        />

        <div className="min-w-0 space-y-7">
          <div>
            <p className="mb-3 text-[14px] font-bold text-white">{f.mediosPago}</p>
            <Logos titulo={f.tarjetas} medios={MARCAS_ACEPTADAS} />
            <Logos titulo={f.transferenciaCo} medios={MEDIOS_TRANSFERENCIA.filter((m) => m.pais === "CO")} />
            <Logos titulo={f.transferenciaUs} medios={MEDIOS_TRANSFERENCIA.filter((m) => m.pais === "US")} />
            <p className="mt-3 text-[12.5px] leading-relaxed">{f.otrosMedios}</p>
          </div>

          <div>
            <p className="mb-3 text-[14px] font-bold text-white">{f.contacto}</p>
            <ul className="space-y-2.5 text-[13.5px]">
              <li>
                <a href={whatsapp.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:text-white">
                  <MessageCircle className="size-4 shrink-0 text-kora-orange" aria-hidden />
                  <span>
                    {f.whatsapp}: <span className="font-semibold text-white">{whatsapp.display}</span>
                  </span>
                </a>
              </li>
              <li>
                <a href={`mailto:${m.email}`} className="flex items-center gap-2.5 break-words hover:text-white">
                  <Mail className="size-4 shrink-0 text-kora-orange" aria-hidden />
                  <span>
                    {f.correo}: <span className="font-semibold text-white">{m.email}</span>
                  </span>
                </a>
              </li>
            </ul>
            {redes.length > 0 && (
              <div className="mt-5">
                <p className="mb-2.5 text-[13px] font-bold text-white">{f.siguenos}</p>
                <ul className="flex flex-wrap gap-2">
                  {redes.map((r) => (
                    <li key={r.nombre}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-full border border-[#2c2f36] px-3.5 py-1.5 text-[12.5px] hover:border-kora-coral hover:text-white"
                      >
                        {r.nombre}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Identificación de los comercios: dirección física y país de cada
          sociedad, como exigen las redes de tarjetas. */}
      <div className="mx-auto mt-10 grid max-w-[1320px] gap-6 border-t border-[#22252b] pt-7 text-[12px] leading-relaxed md:grid-cols-2">
        <div className="min-w-0">
          <p className="font-bold tracking-wide text-[#d4d7dd] uppercase">{m.llc.razonSocial}</p>
          <p className="mt-1 text-[11.5px] text-[#6b7078]">{f.matriz}</p>
          <p className="mt-1.5">
            {m.llc.registro} · {m.llc.domicilio}
          </p>
        </div>
        <div className="min-w-0 md:text-right">
          <p className="font-bold tracking-wide text-[#d4d7dd] uppercase">{m.razonSocial}</p>
          <p className="mt-1 text-[11.5px] text-[#6b7078]">{f.colombia}</p>
          <p className="mt-1.5">
            NIT {m.nit} · {m.matricula} · {m.domicilio}
          </p>
          <p className="mt-1.5 break-words">
            {f.whatsapp}: {whatsapp.display} · {f.correo}: {m.email}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-7 flex max-w-[1320px] flex-col gap-3 border-t border-[#22252b] pt-5 text-xs text-[#6b7078] sm:flex-row sm:items-center sm:justify-between">
        <span>{f.derechos(new Date().getFullYear())}</span>
        {/* Firma de quien diseñó y desarrolló la tienda. */}
        <span>
          {t.layout.firma}{" "}
          <a
            href="https://dangk.framer.website/"
            target="_blank"
            rel="noopener"
            className="font-semibold text-[#A0A4AD] underline underline-offset-2 hover:text-white"
          >
            Dangk
          </a>
        </span>
      </div>
    </footer>
  );
}
