"use client";

// Departamento/estado → ciudad, encadenados. Lo usan el checkout y la
// libreta de direcciones: UNA definición, para que elegir una dirección en
// uno y crearla en el otro sea la misma experiencia.
//
// Las dos listas son oficiales y completas (DANE y Census), así que la
// ciudad es un desplegable CERRADO en los dos países, sin buscador aparte
// (decisión de Daniel, 13 sep 2026): el desplegable nativo ya salta a la
// letra que se teclea. Cambiar la división vacía la ciudad: la anterior ya
// no pertenece a ella.

import { useEffect, useState } from "react";
import { ciudadesDe, listaCerrada } from "@/modules/geo/places";
import { DEPARTAMENTOS_CO, US_STATES } from "@/modules/orders/geo";

export function SelectorDivisionCiudad({
  country,
  state,
  onState,
  city,
  onCity,
  inputCls,
  labelCls,
  errorState,
  errorCity,
}: {
  country: "CO" | "US";
  state: string;
  onState: (s: string) => void;
  city: string;
  onCity: (c: string) => void;
  inputCls: string;
  labelCls: string;
  errorState?: React.ReactNode;
  errorCity?: React.ReactNode;
}) {
  const isCO = country === "CO";
  const ciudades = ciudadesDe(country, state);
  const cerrada = listaCerrada(country);

  // Si la ciudad guardada no pertenece a la división elegida, se limpia.
  const [tocado, setTocado] = useState(false);
  useEffect(() => {
    if (!tocado) return;
    if (cerrada && city && !ciudades.includes(city)) onCity("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      <div>
        <label className={labelCls} htmlFor="state">{isCO ? "Departamento" : "State"}</label>
        <select id="state" name="state" required value={state}
          onChange={(e) => { setTocado(true); onState(e.target.value); if (cerrada) onCity(""); }}
          className={inputCls}>
          <option value="">{isCO ? "Selecciona…" : "Select…"}</option>
          {isCO
            ? DEPARTAMENTOS_CO.map((d) => <option key={d} value={d}>{d}</option>)
            : US_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
        </select>
        {errorState}
      </div>

      <div>
        <label className={labelCls} htmlFor="city">{isCO ? "Ciudad / Municipio" : "City"}</label>
        {cerrada ? (
          <select id="city" name="city" required value={city} onChange={(e) => onCity(e.target.value)}
            disabled={!state} className={`${inputCls} disabled:opacity-60`}>
            {/* La opción vacía va SIEMPRE, y `value={city}` la selecciona
                mientras no haya elección: sin ella, el navegador preselecciona
                la primera ciudad de la lista —"Altamonte Springs" al elegir
                Florida— y un lugar equivocado queda con aspecto de elegido. */}
            <option value="">
              {!state ? (isCO ? "Primero el departamento" : "Select a state first") : isCO ? "Selecciona…" : "Select…"}
            </option>
            {ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <>
            <input id="city" name="city" required value={city} onChange={(e) => onCity(e.target.value)}
              className={inputCls} list="ciudades-sugeridas" placeholder="Ex. Miami" autoComplete="address-level2" />
            <datalist id="ciudades-sugeridas">
              {ciudades.map((c) => <option key={c} value={c} />)}
            </datalist>
          </>
        )}
        {errorCity}
      </div>
    </>
  );
}
