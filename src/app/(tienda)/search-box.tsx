"use client";

// Buscador del header de escritorio, con desplegable de sugerencias.
// Construido contra el prototipo aprobado (`Kora.dc.html`, zona Tienda):
// tarjeta blanca a 56 px del borde superior del campo, filas de 50 px con
// marca, nombre y precio, y un botón oscuro al pie que lleva al catálogo.
//
// **Por qué es cliente y el resto del header no.** El desplegable reacciona a
// cada tecla; el resto del header es contenido servido. El componente se queda
// con el campo y su tarjeta, nada más.
//
// **Lo que NO hace.** No decide precios ni disponibilidad: pide a `/api/buscar`
// y pinta lo que llega, resuelto en servidor por `resolvePrice()`. Un buscador
// que calcule su propio precio es un precio más que puede discrepar del que se
// cobra.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { formatMoney } from "@/modules/pricing";
import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  type SearchSuggestion,
  type SearchSuggestions,
} from "@/modules/storefront/search-types";

/**
 * Espera entre la última tecla y la consulta.
 *
 * 220 ms es el punto donde el desplegable se siente inmediato y aun así una
 * palabra de ocho letras produce una consulta, no ocho.
 */
const DEBOUNCE_MS = 220;

const VACIO: SearchSuggestions = { query: "", items: [], total: 0 };

export function SearchBox() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SearchSuggestions>(VACIO);
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const consulta = value.trim();
  const buscable = consulta.length >= SEARCH_MIN_LENGTH;

  useEffect(() => {
    if (!buscable) {
      setData(VACIO);
      setCargando(false);
      return;
    }

    // `AbortController` no es un detalle: sin él, una respuesta lenta de "cel"
    // puede llegar DESPUÉS de la de "celular" y pintar los resultados de lo que
    // el visitante ya dejó de escribir.
    const control = new AbortController();
    setCargando(true);

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(consulta)}`, {
          signal: control.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        setData((await res.json()) as SearchSuggestions);
      } catch (e) {
        // Una búsqueda cancelada no es un fallo: es la siguiente tecla.
        if ((e as Error)?.name === "AbortError") return;
        setData(VACIO);
      } finally {
        if (!control.signal.aborted) setCargando(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [consulta, buscable]);

  function irAlCatalogo() {
    if (!consulta) return;
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/catalogo?q=${encodeURIComponent(consulta)}`);
  }

  function abrirProducto(slug: string) {
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/producto/${slug}`);
  }

  // El desplegable solo aparece cuando ya hay una respuesta para lo que se
  // está escribiendo. Enseñar la tarjeta mientras carga produce un parpadeo de
  // "sin resultados" en cada palabra que se teclea.
  const respuestaVigente = data.query === consulta;
  const mostrar = open && buscable && respuestaVigente && !cargando;
  const sinResultados = mostrar && data.items.length === 0;

  return (
    <div className="relative flex max-w-[560px] flex-1 flex-col">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          irAlCatalogo();
        }}
        className="flex items-center"
      >
        <div className="flex w-full items-center rounded-full border border-[#2a2e36] bg-[#0E0F12] py-[5px] pr-[6px] pl-5">
          <input
            ref={inputRef}
            type="text"
            name="q"
            value={value}
            maxLength={SEARCH_MAX_LENGTH}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                inputRef.current?.blur();
              }
            }}
            placeholder="Buscar productos, marcas y más…"
            aria-label="Buscar en la tienda"
            // `combobox` y no el rol implícito de `textbox`: es lo que hace que
            // un lector de pantalla anuncie que abajo aparecieron sugerencias.
            // Sin él, `aria-expanded` no significa nada y el desplegable es
            // invisible para quien no ve la pantalla.
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={mostrar}
            aria-controls="sugerencias-busqueda"
            // El navegador ya ofrece su propia lista de valores escritos y se
            // superpone al desplegable.
            autoComplete="off"
            className="flex-1 bg-transparent text-[14.5px] text-[#F5F5F7] outline-none placeholder:text-[#6b7078]"
          />
          <button
            type="submit"
            aria-label="Buscar"
            className="bg-kora-gradient flex size-[42px] shrink-0 items-center justify-center rounded-full text-white hover:opacity-90"
          >
            <Search className="size-5" />
          </button>
        </div>
      </form>

      {mostrar && (
        <>
          {/* Capa que cierra al hacer clic fuera. Un `onBlur` en el campo no
              sirve: el clic en una fila la dispara antes de que el enlace se
              active, y el desplegable se cierra sin navegar. */}
          <button
            type="button"
            aria-label="Cerrar sugerencias"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[90] cursor-default"
          />

          <div
            id="sugerencias-busqueda"
            className="absolute top-[56px] right-0 left-0 z-[120] max-h-[64vh] overflow-y-auto rounded-2xl bg-white p-2.5 shadow-[0_22px_60px_rgba(0,0,0,0.35)]"
          >
            {sinResultados ? (
              <div className="px-5 py-[34px] text-center">
                <Search className="mx-auto size-[42px] text-[#e2ddd6]" aria-hidden />
                <p className="mt-3 mb-1 text-sm font-semibold text-kora-black">
                  Sin resultados para “{data.query}”
                </p>
                <p className="text-[12.5px] text-[#8a8f98]">
                  Prueba con otra palabra o explora las categorías.
                </p>
              </div>
            ) : (
              <>
                <p className="px-2.5 pt-1.5 pb-2 text-[10.5px] font-bold tracking-[0.5px] text-[#9aa0ab] uppercase">
                  Resultados para “{data.query}”
                </p>

                <div className="flex flex-col gap-0.5">
                  {data.items.map((item: SearchSuggestion) => (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => abrirProducto(item.slug)}
                      className="flex items-center gap-[11px] rounded-[11px] p-[9px] text-left hover:bg-[#faf8f5]"
                    >
                      <span className="relative size-[50px] shrink-0 overflow-hidden rounded-[10px] bg-[#f4f1ec]">
                        {item.image && (
                          <Image
                            src={item.image.url}
                            alt={item.image.alt ?? item.name}
                            fill
                            sizes="50px"
                            // `contain`, como en toda la tienda: recortar una
                            // foto de producto le quita producto.
                            className="object-contain"
                          />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        {item.brand && (
                          <span className="block truncate text-[10px] font-semibold tracking-[0.3px] text-[#9aa0ab] uppercase">
                            {item.brand}
                          </span>
                        )}
                        <span className="block truncate text-[12.5px] leading-[1.25] font-semibold text-kora-black">
                          {item.name}
                        </span>
                        {item.price?.available && (
                          <span className="mt-0.5 flex items-baseline gap-1.5">
                            {item.price.hasOnlineDiscount && (
                              <span className="text-[10.5px] text-[#b3b8c0] line-through">
                                {formatMoney(item.price.storeAmount, item.price.currency)}
                              </span>
                            )}
                            <span className="text-[13px] font-bold text-[#FF5A1F]">
                              {formatMoney(item.price.amount, item.price.currency)}
                            </span>
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={irAlCatalogo}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[11px] bg-kora-black p-3 text-[13px] font-bold text-white hover:bg-[#FF5A1F]"
                >
                  Ver todos los resultados ({data.total})
                  <ArrowRight className="size-[15px]" aria-hidden />
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
