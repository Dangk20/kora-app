"use client";

// Quién manda en la parte inferior de la pantalla en móvil.
//
// El diseño (§05) es explícito: cuando aparece la barra de compra de la ficha,
// la de navegación **se oculta** — *"nunca se superponen"*. Y no pueden
// negociarlo entre ellas por su cuenta: la de navegación vive en el layout de
// la tienda y la de compra en la ficha, así que no se ven.
//
// Un contexto en lugar de una clase en `document.body`: el estado de React
// se limpia solo al desmontar. Con una clase en el body, salir de la ficha con
// el botón atrás en mitad de una transición deja la navegación oculta y sin
// nada que la devuelva — un teléfono sin barra inferior y sin forma de saber
// por qué.

import { createContext, useContext, useEffect, useState } from "react";

type Bars = {
  /** ¿Hay una barra inferior propia de la página ocupando el sitio? */
  buyBarVisible: boolean;
  setBuyBarVisible: (v: boolean) => void;
};

const BarsContext = createContext<Bars>({
  buyBarVisible: false,
  setBuyBarVisible: () => {},
});

export function MobileBarsProvider({ children }: { children: React.ReactNode }) {
  const [buyBarVisible, setBuyBarVisible] = useState(false);
  return (
    <BarsContext.Provider value={{ buyBarVisible, setBuyBarVisible }}>
      {children}
    </BarsContext.Provider>
  );
}

/** Para la barra de navegación: ¿debe apartarse? */
export function useBuyBarVisible(): boolean {
  return useContext(BarsContext).buyBarVisible;
}

/**
 * Para una página con barra inferior propia: la declara mientras esté montada
 * y la retira al salir.
 */
export function useOwnsBottomBar(visible: boolean): void {
  const { setBuyBarVisible } = useContext(BarsContext);

  useEffect(() => {
    setBuyBarVisible(visible);
    // Al desmontar SIEMPRE se libera, pase lo que pase con `visible`: si no,
    // navegar fuera de la ficha dejaría la navegación escondida.
    return () => setBuyBarVisible(false);
  }, [visible, setBuyBarVisible]);
}
