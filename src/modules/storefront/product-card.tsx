// Card de producto del listado — patrón del prototipo (§4.1): media 170px,
// cuerpo en columna, precio abajo. Sin botón de compra (ver el comentario de
// `ProductCard`) y sin las promesas comerciales del mock (cuotas,
// calificaciones, envío gratis): no están validadas con el cliente y KORA no
// tiene pasarela de pago.
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

  const clases =
    "group flex flex-col overflow-hidden rounded-2xl border border-[#efe9e1] bg-white transition-[transform,box-shadow] duration-200 hover:-translate-y-1.5 hover:shadow-[0_18px_38px_rgba(0,0,0,0.1)]";

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
      <div
        className="relative flex h-[170px] items-center justify-center overflow-hidden"
        style={{ background: image ? "#f7f4f0" : product.category.color }}
      >
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? product.name}
            fill
            sizes="(max-width: 900px) 50vw, 25vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          // Sin foto todavía: el glifo de la categoría, como el prototipo.
          <CategoryTile
            color={product.category.color}
            icon={product.category.icon}
            size={96}
            radius={0}
          />
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
