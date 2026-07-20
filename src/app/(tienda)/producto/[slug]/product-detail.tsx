"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { resolvePrice, type Currency } from "@/modules/pricing";
import { PriceTag } from "@/modules/storefront/price-tag";
import type { StoreProduct } from "@/modules/storefront/queries";
import { CategoryTile } from "@/modules/catalog/tiles";
import { useCart } from "@/modules/cart/cart-context";

/**
 * Bloque principal de la ficha: galería + selección de variante.
 * Al cambiar de variante, el precio se actualiza al de esa variante
 * (TIE_HU002 §1) — siempre a través de `resolvePrice`, nunca calculado aquí.
 */
export function ProductDetail({
  product,
  currency,
}: {
  product: StoreProduct;
  currency: Currency;
}) {
  const router = useRouter();
  const cart = useCart();
  const [variantId, setVariantId] = useState(
    // Arranca en la primera variante con cupo online; si no hay, la primera.
    product.variants.find((v) => v.onlineUnits > 0)?.id ?? product.variants[0]?.id,
  );
  const [imageIndex, setImageIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const variant =
    product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const price = variant ? resolvePrice(variant.prices, currency) : null;
  const units = variant?.onlineUnits ?? 0;
  const soldOut = units === 0 || !price?.available;
  const image = product.images[imageIndex];

  // Nunca se puede pedir más que el cupo publicado online.
  const maxQty = Math.max(1, units);
  const clampQty = (n: number) => Math.min(Math.max(1, n), maxQty);

  const chooseVariant = (id: string) => {
    setVariantId(id);
    setQty(1); // el cupo cambia con la variante
    setJustAdded(false);
  };

  const addToCart = () => {
    if (!variant || soldOut) return;
    cart.add(variant.id, qty);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2500);
  };

  const buyNow = () => {
    if (!variant || soldOut) return;
    cart.add(variant.id, qty);
    router.push("/checkout");
  };

  return (
    <div className="grid gap-10 rounded-3xl bg-white p-8 shadow-[0_6px_28px_rgba(0,0,0,0.05)] lg:grid-cols-[480px_1fr]">
      {/* Galería */}
      <div>
        <div
          className="relative flex h-[430px] items-center justify-center overflow-hidden rounded-[18px]"
          style={{ background: image ? "#f7f4f0" : product.category.color }}
        >
          {image ? (
            <Image
              src={image.url}
              alt={image.alt ?? product.name}
              fill
              sizes="480px"
              priority
              className="object-contain"
              unoptimized
            />
          ) : (
            <CategoryTile
              color="transparent"
              icon={product.category.icon}
              size={200}
              radius={0}
            />
          )}
        </div>

        {product.images.length > 1 && (
          <div className="mt-3.5 grid grid-cols-4 gap-3">
            {product.images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setImageIndex(i)}
                aria-label={`Ver imagen ${i + 1}`}
                aria-current={i === imageIndex}
                className={`relative h-[86px] overflow-hidden rounded-xl border-2 bg-[#f7f4f0] ${
                  i === imageIndex ? "border-kora-coral" : "border-[#e2ddd6]"
                }`}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="110px"
                  className="object-cover"
                  unoptimized
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Información */}
      <div>
        {product.brand && (
          <p className="mb-1.5 text-xs font-semibold tracking-[0.5px] text-[#9aa0ab] uppercase">
            {product.brand}
          </p>
        )}
        <h1 className="text-[28px] leading-[1.18] font-bold text-kora-black">
          {product.name}
        </h1>
        <p className="mt-2 text-[13px] text-[#8a8f98]">
          Vendido por <span className="font-semibold text-kora-coral">KORA</span>
        </p>

        <div className="mt-5">{price && <PriceTag price={price} size="detail" />}</div>

        <div className="my-6 h-px bg-[#efe9e1]" />

        {product.variants.length > 1 && (
          <div className="mb-6">
            <p className="mb-2.5 text-[12.5px] font-semibold text-[#6b6f78]">
              Elige una opción
            </p>
            <div className="flex flex-wrap gap-2.5">
              {product.variants.map((v) => {
                const chosen = v.id === variantId;
                const agotada = v.onlineUnits === 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => chooseVariant(v.id)}
                    aria-pressed={chosen}
                    className={`min-w-[54px] rounded-[11px] border-[1.6px] px-[18px] py-2.5 text-[13.5px] font-semibold transition-colors ${
                      chosen
                        ? "border-kora-black bg-kora-black text-white"
                        : "border-[#d9d4cc] bg-white text-kora-black hover:border-kora-coral"
                    } ${agotada ? "line-through opacity-50" : ""}`}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Disponibilidad: el cupo online, no el stock físico total */}
        <div className="mb-6 flex items-center gap-2">
          <span
            className={`size-[9px] rounded-full ${
              soldOut ? "bg-[#b3b8c0]" : "bg-kora-orange"
            }`}
            aria-hidden
          />
          <p className="text-[13.5px] font-semibold text-kora-black">
            {soldOut ? (
              "Agotado en la tienda online"
            ) : (
              <>
                Quedan {units} {units === 1 ? "unidad" : "unidades"}
                {units <= 8 && (
                  <span className="font-semibold text-kora-coral">
                    {" "}
                    · ¡Últimas unidades!
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        {/* Cantidad */}
        {!soldOut && (
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center overflow-hidden rounded-xl border-[1.6px] border-[#e2ddd6]">
              <button
                type="button"
                onClick={() => setQty((q) => clampQty(q - 1))}
                disabled={qty <= 1}
                aria-label="Quitar una unidad"
                className="flex size-11 items-center justify-center text-kora-black hover:bg-[#faf8f5] disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>
              <span
                className="w-12 text-center text-base font-bold text-kora-black"
                aria-live="polite"
              >
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => clampQty(q + 1))}
                disabled={qty >= maxQty}
                aria-label="Agregar una unidad"
                className="flex size-11 items-center justify-center text-kora-black hover:bg-[#faf8f5] disabled:opacity-40"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <span className="text-[12.5px] text-[#8a8f98]">Cantidad</span>
          </div>
        )}

        {/* Comprar ahora lleva al checkout; el pedido se envía por WhatsApp
            al final del formulario (PED_HU001/002). */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={buyNow}
            disabled={soldOut}
            className="bg-kora-gradient flex w-full items-center justify-center rounded-full px-6 py-4 text-[15px] font-bold text-white shadow-[0_10px_26px_rgba(255,90,31,0.32)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
          >
            {soldOut ? "Agotado" : "Comprar ahora"}
          </button>
          <button
            type="button"
            onClick={addToCart}
            disabled={soldOut}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border-[1.8px] border-kora-black bg-white px-6 py-4 text-[15px] font-bold text-kora-black transition-colors hover:bg-kora-black hover:text-white disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white disabled:hover:text-kora-black"
          >
            {justAdded ? (
              <>
                <Check className="size-[18px]" /> Agregado al carrito
              </>
            ) : (
              <>
                <ShoppingCart className="size-[18px]" /> Agregar al carrito
              </>
            )}
          </button>
        </div>
        <p className="mt-2.5 text-center text-[11.5px] text-[#8a8f98]">
          Completas tus datos y finalizas el pedido por WhatsApp.
        </p>
      </div>
    </div>
  );
}
