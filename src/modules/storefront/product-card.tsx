// Card de producto del listado — patrón del prototipo (§4.1): foto en
// contenedor CUADRADO, cuerpo en columna, precio abajo. Sin botón de compra
// (ver el comentario de `ProductCard`) y sin las promesas comerciales del mock
// (cuotas, calificaciones, envío gratis): no están validadas con el cliente y
// KORA no tiene pasarela de pago.
import Image from "next/image";
import Link from "next/link";
import { resolvePrice, type Currency } from "@/modules/pricing";
import { CategoryTile, inkFor } from "@/modules/catalog/tiles";
import { availableUnits, productAmounts, type StoreProduct } from "./queries";
import { PriceTag } from "./price-tag";

/**
 * Tarjeta de producto: toda ella es el enlace a la ficha.
 *
 * NO lleva control de compra, y no es un olvido. Muchos productos de KORA
 * tienen variantes, y añadir desde la tarjeta obliga a elegir una por el
 * comprador —generando carritos con la talla equivocada, que se descubren en
 * la conversación de WhatsApp con alguien ya atendiendo— o a mandarlo a la
 * ficha igualmente, que es un botón prometiendo algo que no hace.
 *
 * Sin el botón, el área táctil deja de competir con nada y el precio gana el
 * espacio que ocupaba — que es la información que más se compara.
 *
 * Ver docs/auditoria-fidelidad-escritorio.md §D2 y el diseño móvil §04.
 */
export function ProductCard({
  product,
  currency,
  preview = false,
}: {
  product: StoreProduct;
  currency: Currency;
  /**
   * Vista previa de Vitrina: la tarjeta se ve igual pero NO navega.
   *
   * El operador está ahí ordenando la portada; un clic que lo saque al
   * catálogo público le hace perder lo que estaba mirando. Antes esta bandera
   * solo apagaba el botón —y la tarjeta entera seguía siendo un enlace, así
   * que sacaba igual—; ahora apaga lo único que queda.
   */
  preview?: boolean;
}) {
  const units = availableUnits(product);
  const soldOut = units === 0;
  const amounts = productAmounts(product, currency);
  const cheapest = amounts.length ? Math.min(...amounts) : null;
  // El precio de la card es el de la variante más barata disponible.
  const variant =
    product.variants.find(
      (v) => resolvePrice(v.prices, currency).amount === cheapest,
    ) ?? product.variants[0];
  const price = variant ? resolvePrice(variant.prices, currency) : null;
  const image = product.images[0];
  const multiPrice = new Set(amounts).size > 1;

  // Porcentaje de ahorro, derivado del precio resuelto. No hay campo de
  // "descuento" en la base a propósito: el ahorro es una consecuencia de que
  // el precio online sea menor, no un dato que alguien pueda dejar mentiroso.
  const ahorro =
    price?.hasOnlineDiscount && price.storeAmount > 0
      ? Math.round(((price.storeAmount - price.amount) / price.storeAmount) * 100)
      : null;

  // Movimiento de la tarjeta al pasar el cursor.
  //
  // UNA sola curva para las tres cosas que se mueven —la tarjeta, la foto y la
  // pastilla— y no la de por defecto. Antes cada una tenía su duración (200,
  // 300 y 200 ms) con la curva del navegador: empezaban juntas y terminaban
  // en tres momentos distintos, y eso es lo que se siente como un tirón en
  // vez de un movimiento. `cubic-bezier(0.22,1,0.36,1)` sale rápido y frena
  // largo, que es como se mueven las cosas con peso.
  //
  // Entrar es lento (se disfruta), salir es rápido (nadie quiere esperar a
  // que una tarjeta que ya dejó de mirar termine de bajar): de ahí las dos
  // duraciones, la corta en la base y la larga en `group-hover`.
  //
  // ⚠️ La lista de propiedades dice `translate`, NO `transform`, y ahí estaba
  // el tirón. Tailwind 4 dejó de meter `-translate-y` y `scale` dentro de
  // `transform`: ahora usa las propiedades CSS `translate` y `scale` por
  // separado. Una lista escrita a mano con `transition-[transform,…]` deja
  // fuera justo lo que se mueve, así que el desplazamiento ocurre DE GOLPE
  // —sin transición— y ninguna curva ni duración lo suaviza, porque no se
  // están aplicando a nada. No da error y en el código se lee correcto.
  // Las utilidades propias de Tailwind (`transition-transform`) sí incluyen
  // las cuatro; el riesgo está solo en las listas arbitrarias.
  const CURVA = "ease-[cubic-bezier(0.22,1,0.36,1)]";
  const clases =
    "group flex flex-col overflow-hidden rounded-2xl border border-[#efe9e1] bg-white " +
    `transition-[translate,box-shadow] duration-200 ${CURVA} ` +
    "hover:-translate-y-2 hover:duration-[420ms] " +
    "hover:shadow-[0_22px_46px_-14px_rgba(22,24,29,0.22)] " +
    "motion-reduce:transition-none motion-reduce:hover:translate-y-0";

  // Un solo elemento envolviendo toda la tarjeta: un objetivo táctil y un
  // único enlace anunciado por lector de pantalla, con el nombre del producto.
  const Envoltura = ({ children }: { children: React.ReactNode }) =>
    preview ? (
      <div className={clases}>{children}</div>
    ) : (
      <Link href={`/producto/${product.slug}`} className={clases}>
        {children}
      </Link>
    );

  return (
    <Envoltura>
      {/* Contenedor CUADRADO de la foto.

          `aspect-square` y no una altura fija: con altura fija el contenedor
          cambia de proporción según el ancho de la columna, y la misma foto se
          ve distinta en el home, en el catálogo y en relacionados. */}
      <div
        className="relative flex aspect-square items-center justify-center overflow-hidden"
        style={{ background: image ? "#f7f4f0" : product.category.color }}
      >
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            // `contain` y NO `cover`: las fotos del catálogo son packshots —el
            // producto entero sobre fondo claro—. `cover` recorta para llenar,
            // y en un packshot lo que recorta es el producto: una licuadora
            // alta pierde la jarra, un teclado ancho pierde las teclas de los
            // extremos. Hoy no se nota porque no hay ni una foto cargada; se
            // notaría en TODAS las tarjetas el día que llegue el catálogo real.
            // El acercamiento va MUY lento a propósito (700 ms): un zoom
            // rápido se lee como un salto; uno lento se lee como que la
            // tarjeta respira. Es la parte llamativa del gesto.
            className={`object-contain p-4 transition-transform duration-300 ${CURVA} group-hover:scale-[1.07] group-hover:duration-700 motion-reduce:transition-none motion-reduce:group-hover:scale-100`}
            unoptimized
          />
        ) : (
          // Sin foto todavía: el glifo de la categoría, como el prototipo.
          //
          // Lleva el MISMO acercamiento que llevaría la foto. Si no, el gesto
          // del cursor dependería de si el producto tiene imagen cargada: la
          // mitad del catálogo respiraría y la otra mitad no, sin ninguna
          // razón que el comprador pueda ver.
          <span
            className={`transition-transform duration-300 ${CURVA} group-hover:scale-[1.07] group-hover:duration-700 motion-reduce:transition-none motion-reduce:group-hover:scale-100`}
          >
            <CategoryTile
              color={product.category.color}
              icon={product.category.icon}
              size={96}
              radius={0}
            />
          </span>
        )}

        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {soldOut && (
            <span className="rounded-full bg-[#8a8f98] px-2 py-1 text-[10.5px] font-semibold text-white">
              Agotado
            </span>
          )}
          {product.featured && !soldOut && (
            <span className="rounded-full bg-kora-black px-2 py-1 text-[10.5px] font-semibold text-white">
              Destacado
            </span>
          )}
          {price?.hasOnlineDiscount && !soldOut && (
            <span className="bg-kora-gradient rounded-full px-2 py-1 text-[10.5px] font-bold text-white">
              Precio online
            </span>
          )}
        </div>

        {/* Porcentaje de ahorro, arriba a la derecha. Sale del precio real
            resuelto, no de un campo de descuento: si mañana el precio online
            deja de ser menor, el porcentaje desaparece solo. */}
        {ahorro !== null && !soldOut && (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-white px-2 py-1 text-[11px] font-extrabold text-kora-black shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            −{ahorro}%
          </span>
        )}

        {/* Señal de que la tarjeta es pulsable, solo con puntero fino: en
            táctil no hay hover, y una pastilla que aparece "al pasar el dedo"
            sería un botón fantasma. No lleva acciones propias —comparar,
            favoritos, vista rápida— porque son funciones que KORA no tiene, y
            pintar un icono que no hace nada es peor que no pintarlo. */}
        {!preview && !soldOut && (
          <span
            aria-hidden
            className={
              "pointer-events-none absolute inset-x-3 bottom-3 hidden translate-y-3 rounded-full " +
              "bg-kora-black/90 py-2 text-center text-[12px] font-bold text-white opacity-0 " +
              "shadow-[0_10px_24px_-6px_rgba(22,24,29,0.45)] " +
              // El retardo va SOLO en `group-hover`, no en la base: así entra
              // un instante después de que la tarjeta empieza a subir —que es
              // lo que hace que el gesto se lea como uno y no como tres cosas
              // disparadas a la vez— pero al salir se va sin quedarse colgada.
              `transition-[opacity,translate] duration-200 delay-0 ${CURVA} ` +
              "group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-[70ms] group-hover:duration-[360ms] " +
              "motion-reduce:transition-none " +
              "[@media(hover:hover)_and_(pointer:fine)]:block"
            }
          >
            Ver producto
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-3.5 pt-3 pb-4">
        {product.brand && (
          <p className="mb-1 text-[11px] font-semibold tracking-[0.4px] text-[#9aa0ab] uppercase">
            {product.brand}
          </p>
        )}
        <p className="mb-2 line-clamp-2 h-9 text-[13.5px] leading-[1.32] text-kora-black">
          {product.name}
        </p>

        <div className="mt-auto">
          <div className="space-y-1">
            {price && <PriceTag price={price} />}
            {multiPrice && price?.available && (
              <p className="text-[11px] text-[#8a8f98]">
                Desde · {product.variants.length} variantes
              </p>
            )}
          </div>
        </div>
      </div>
    </Envoltura>
  );
}

/** Tile circular de categoría del home (§7.1). */
export function CategoryCircle({
  name,
  slug,
  color,
  icon,
}: {
  name: string;
  slug: string;
  color: string;
  icon: string;
}) {
  return (
    <Link href={`/catalogo?categoria=${slug}`} className="group flex flex-col items-center gap-2">
      <span
        className="flex size-[62px] items-center justify-center rounded-full transition-colors"
        style={{ background: color, color: inkFor(color) }}
      >
        <CategoryTile color="transparent" icon={icon} size={62} radius={999} />
      </span>
      <span className="text-center text-[11.5px] text-[#4a4f58] group-hover:text-kora-coral">
        {name}
      </span>
    </Link>
  );
}
