"use client";

// Carrusel de un espacio publicitario. Con una sola pieza es una imagen
// quieta; con varias, rota sola y muestra los puntos para saltar.
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import type { ResolvedBanner } from "@/modules/showcase/queries";

const ROTATE_MS = 5000;

export function BannerCarousel({
  banners,
  className,
  placeholderLabel,
}: {
  banners: ResolvedBanner[];
  className?: string;
  placeholderLabel: string;
}) {
  // En la tienda solo se ven las piezas activas y con imagen.
  const slides = banners.filter((b) => b.active && b.imageUrl);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback(
    (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [slides.length, paused]);

  // Si se elimina una pieza mientras se ve, el índice puede quedar fuera.
  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  if (slides.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-[#e2ddd6] bg-[#faf8f5] text-center ${className ?? ""}`}
      >
        <ImageOff className="size-8 text-[#d9d4cc]" />
        <p className="px-6 text-[12.5px] text-[#9aa0ab]">{placeholderLabel}</p>
      </div>
    );
  }

  const current = slides[Math.min(index, slides.length - 1)];

  return (
    <div
      className={`group/carousel relative overflow-hidden rounded-[18px] ${className ?? ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((banner, i) => {
        const image = (
          <Image
            src={banner.imageUrl!}
            alt={banner.title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            unoptimized
            priority={i === 0}
          />
        );
        return (
          <div
            key={banner.id}
            aria-hidden={i !== index}
            className={`absolute inset-0 transition-opacity duration-500 ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {banner.href ? (
              <Link href={banner.href} className="group/banner block size-full">
                {image}
                {/* El botón aclara que la pieza lleva a algún lado: sin él,
                    la imagen no se lee como enlace. */}
                <span className="pointer-events-none absolute right-4 bottom-4 flex translate-y-1 items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[13.5px] font-bold text-kora-black opacity-0 shadow-[0_8px_22px_rgba(0,0,0,0.25)] transition-all duration-200 group-hover/banner:translate-y-0 group-hover/banner:opacity-100">
                  Ver producto
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            ) : (
              image
            )}
          </div>
        );
      })}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => go(index - 1)}
            className="absolute top-1/2 left-2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-kora-black opacity-0 transition-opacity group-hover/carousel:opacity-100"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => go(index + 1)}
            className="absolute top-1/2 right-2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-kora-black opacity-0 transition-opacity group-hover/carousel:opacity-100"
          >
            <ChevronRight className="size-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {slides.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Ver pieza ${i + 1} de ${slides.length}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-5 bg-white" : "w-2 bg-white/60 hover:bg-white/90"
                }`}
              />
            ))}
          </div>
        </>
      )}

      <span className="sr-only">{current.title}</span>
    </div>
  );
}
