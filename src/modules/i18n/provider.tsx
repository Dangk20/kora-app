"use client";

// El idioma activo para los componentes cliente de la tienda. Recibe solo el
// IDIOMA (una cadena): el diccionario se importa aquí, porque sus funciones
// de interpolación no pueden viajar del servidor al cliente como props.
import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./index";
import { MESSAGES, type Messages } from "./messages";

const LocaleContext = createContext<Locale>("es");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useMessages(): Messages {
  return MESSAGES[useContext(LocaleContext)];
}
