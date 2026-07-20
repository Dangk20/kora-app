"use client";

// Pantalla puente (PED_HU002 §3): el pedido ya existe; se abre WhatsApp
// automáticamente a los 2 segundos, con botón manual por si el navegador
// bloquea la apertura.
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, MessageCircle } from "lucide-react";

export function OrderBridge({
  orderNumber,
  whatsappUrl,
}: {
  orderNumber: string;
  whatsappUrl: string;
}) {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpened(true);
      window.location.href = whatsappUrl;
    }, 2000);
    return () => clearTimeout(timer);
  }, [whatsappUrl]);

  return (
    <div className="mx-auto max-w-[640px] px-[22px] py-16 text-center">
      <div className="rounded-3xl bg-white p-10 shadow-[0_6px_28px_rgba(0,0,0,0.05)]">
        <span className="mx-auto flex size-[74px] items-center justify-center rounded-full bg-[#FFE9DD]">
          <CheckCircle2 className="size-9 text-kora-orange" />
        </span>
        <h1 className="mt-5 text-[26px] font-extrabold text-kora-black">
          ¡Tu pedido {orderNumber} fue creado! 🔥
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[#4a4f58]">
          {opened
            ? "Abrimos WhatsApp con tu pedido listo para enviar."
            : "Te estamos llevando a WhatsApp con tu pedido listo para enviar…"}
        </p>

        <a
          href={whatsappUrl}
          className="bg-kora-gradient mt-7 inline-flex items-center justify-center gap-2.5 rounded-full px-7 py-4 text-[15px] font-bold text-white shadow-[0_10px_26px_rgba(255,90,31,0.32)] hover:opacity-90"
        >
          <MessageCircle className="size-[18px]" /> Abrir WhatsApp
        </a>

        <div className="mt-7 rounded-[13px] bg-[#FFF4EF] px-5 py-4 text-left">
          <p className="text-[12.5px] leading-relaxed text-[#4a4f58]">
            <strong className="font-semibold text-kora-black">Importante:</strong> tu
            pedido se confirma cuando completes la conversación en WhatsApp.
            Tiene una validez de <strong>2 horas</strong>.
          </p>
        </div>

        <Link
          href="/catalogo"
          className="mt-6 inline-block text-[13px] font-semibold text-[#8a8f98] hover:text-kora-black"
        >
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}
