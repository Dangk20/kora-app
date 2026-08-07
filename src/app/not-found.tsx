// Página no encontrada — de TODA la aplicación.
//
// Vive en la raíz y no en cada sección a propósito. Un `not-found.tsx`
// ANIDADO renderiza su contenido pero **deja el estado en 200**: solo el de
// raíz devuelve 404. Se comprobó contra un build de producción real — una
// ruta inventada daba 404 y un producto inexistente daba 200 con la pantalla
// anidada.
//
// Y un 200 en una página que dice "esto no existe" es un *soft 404*: el
// buscador la indexa. Para KORA eso significa que cada producto que el
// operador despublique se queda en Google compitiendo con los que sí vende, y
// llevando al comprador a una página vacía.
//
// El texto sirve para las dos entradas —una URL mal escrita y un producto
// retirado— porque tener la redacción exacta no vale un estado equivocado.
import Link from "next/link";
import { PackageX } from "lucide-react";

export default function NoEncontrado() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#F5F3F0] px-5 py-16 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-white text-[#b3b8c0]">
        <PackageX className="size-7" aria-hidden />
      </span>
      <h1 className="text-[21px] font-extrabold text-kora-black">
        No encontramos lo que buscabas
      </h1>
      <p className="mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-[#8a8f98]">
        Puede que el producto ya no esté disponible o que la dirección no sea
        correcta. Mira el catálogo — es probable que tengamos algo parecido.
      </p>
      <Link
        href="/catalogo"
        className="bg-kora-gradient mt-6 flex min-h-12 items-center justify-center rounded-full px-7 text-[14px] font-bold text-white"
      >
        Ver el catálogo
      </Link>
    </div>
  );
}
