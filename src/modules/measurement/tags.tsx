"use client";

// Etiquetas de Meta y Google en la tienda, detrás del consentimiento.
//
// El banner NO es decorativo: es la puerta. Hasta que el visitante elige
// "Aceptar" no se inyecta ningún <script> de terceros, y si elige "Solo
// necesarias" no se inyecta nunca. Ley 1581 de 2012: la autorización es
// previa, expresa e informada.
//
// Se monta solo en el layout de la tienda: el panel y el centro legal no miden.

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/modules/i18n/provider";
import {
  COOKIE_CONSENTIMIENTO,
  COOKIE_ORIGEN,
  DIAS_CONSENTIMIENTO,
  DIAS_ORIGEN,
  mergeTouch,
  parseTouch,
  serializeTouch,
  touchFromVisit,
} from "./attribution";
import type { MeasurementPublicConfig } from "./config";
import { trackPageView } from "./track";

/** Lo emite el enlace "Preferencias de cookies" del footer para reabrir el aviso. */
export const EVENTO_PREFERENCIAS = "kora:preferencias-cookies";

type Eleccion = "si" | "no" | null;

function leerCookie(nombre: string): string | null {
  const par = document.cookie.split("; ").find((c) => c.startsWith(`${nombre}=`));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
}

function escribirCookie(nombre: string, valor: string, dias: number): void {
  const seguro = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${nombre}=${encodeURIComponent(valor)}; Max-Age=${dias * 86_400}; Path=/; SameSite=Lax${seguro}`;
}

/** Borra las cookies de las plataformas al retirar la autorización. */
function borrarCookiesDeTerceros(): void {
  const dominio = location.hostname.replace(/^www\./, "");
  for (const c of document.cookie.split("; ")) {
    const nombre = c.split("=")[0];
    if (
      nombre === "_fbp" ||
      nombre === "_fbc" ||
      nombre === "_ga" ||
      nombre.startsWith("_ga_") ||
      nombre.startsWith("_gcl") ||
      nombre === "_clck" ||
      nombre === "_clsk"
    ) {
      for (const d of ["", `; Domain=${dominio}`, `; Domain=.${dominio}`]) {
        document.cookie = `${nombre}=; Max-Age=0; Path=/${d}`;
      }
    }
  }
}

export function MeasurementTags({
  config,
  privacyUrl,
}: {
  config: MeasurementPublicConfig;
  privacyUrl: string;
}) {
  const t = useMessages().cookies;
  const pathname = usePathname();
  const activa = Boolean(config.metaPixelId || config.ga4Id || config.clarityId);
  const [eleccion, setEleccion] = useState<Eleccion>(null);
  const [visible, setVisible] = useState(false);

  // Origen de la visita: una cookie propia que no identifica a nadie, así que
  // se escribe con o sin consentimiento (como la del carrito).
  useEffect(() => {
    const visita = touchFromVisit(new URL(location.href), document.referrer || null);
    const final = mergeTouch(parseTouch(leerCookie(COOKIE_ORIGEN)), visita);
    if (visita && final) escribirCookie(COOKIE_ORIGEN, serializeTouch(final), DIAS_ORIGEN);
  }, []);

  useEffect(() => {
    if (!activa) return;
    const v = leerCookie(COOKIE_CONSENTIMIENTO);
    const e: Eleccion = v === "si" || v === "no" ? v : null;
    setEleccion(e);
    setVisible(e === null);
    const reabrir = () => setVisible(true);
    window.addEventListener(EVENTO_PREFERENCIAS, reabrir);
    return () => window.removeEventListener(EVENTO_PREFERENCIAS, reabrir);
  }, [activa]);

  const elegir = useCallback(
    (e: "si" | "no") => {
      const antes = eleccion;
      escribirCookie(COOKIE_CONSENTIMIENTO, e, DIAS_CONSENTIMIENTO);
      setEleccion(e);
      setVisible(false);
      // Retirar una autorización ya dada: los scripts ya cargados no se
      // descargan, así que se borran sus cookies y se recarga limpio.
      if (antes === "si" && e === "no") {
        borrarCookiesDeTerceros();
        location.reload();
      }
    },
    [eleccion],
  );

  // Una vista de página por navegación, incluidas las del lado del cliente.
  useEffect(() => {
    if (eleccion === "si") trackPageView();
  }, [eleccion, pathname]);

  if (!activa) return null;

  const nombres = [
    config.metaPixelId && "Meta",
    config.ga4Id && "Google",
    config.clarityId && "Microsoft Clarity",
  ].filter((n): n is string => Boolean(n));
  const plataformas =
    nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} ${t.y} ${nombres[nombres.length - 1]}` : nombres[0];

  return (
    <>
      {eleccion === "si" && config.metaPixelId && (
        <Script id="kora-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(config.metaPixelId)});`}
        </Script>
      )}
      {eleccion === "si" && config.ga4Id && (
        <>
          <Script
            id="kora-gtag-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4Id}`}
            strategy="afterInteractive"
          />
          <Script id="kora-gtag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;gtag('js',new Date());
gtag('config',${JSON.stringify(config.ga4Id)});
${config.googleAdsId ? `gtag('config',${JSON.stringify(config.googleAdsId)});` : ""}`}
          </Script>
        </>
      )}

      {eleccion === "si" && config.clarityId && (
        // Clarity enmascara por omisión los campos de formulario (modo
        // "Equilibrado"): los datos del checkout no quedan en las grabaciones.
        <Script id="kora-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", ${JSON.stringify(config.clarityId)});`}
        </Script>
      )}

      {visible && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label={t.titulo}
          className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-[560px] rounded-2xl bg-kora-black p-5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] lg:bottom-6"
        >
          <p className="text-[15px] font-bold">{t.titulo}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#C9CCD3]">
            {t.texto(plataformas)}{" "}
            <a href={privacyUrl} className="font-semibold text-white underline underline-offset-2">
              {t.politica}
            </a>
          </p>
          {/* Mismo peso visual para las dos opciones: rechazar no puede ser
              más difícil que aceptar. */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={() => elegir("no")}
            >
              {t.rechazar}
            </Button>
            <Button type="button" variant="brand" onClick={() => elegir("si")}>
              {t.aceptar}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Enlace del footer para cambiar la elección. Solo se muestra si hay medición. */
export function CookiePreferencesLink({ className }: { className?: string }) {
  const t = useMessages().cookies;
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(EVENTO_PREFERENCIAS))}
    >
      {t.preferencias}
    </button>
  );
}
