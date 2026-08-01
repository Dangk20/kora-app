"use client";

// Perfil del cliente (CLI_HU002). Panel lateral de SOLO LECTURA: la edición
// vive en su propio panel, como pide la historia de usuario.

import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { KoraFlame } from "@/components/kora-flame";
import type { CustomerMetrics, TopCategory } from "@/modules/customers/profile";

function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function money(valor: number, moneda: string): string {
  return new Intl.NumberFormat(moneda === "USD" ? "en-US" : "es-CO", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: moneda === "USD" ? 2 : 0,
  }).format(valor);
}

function Metrica({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[12px] border border-[#eee9e2] px-3.5 py-3 text-center">
      <div className="text-[19px] font-extrabold text-kora-black">{value}</div>
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
      {hint && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={value ? "text-right font-medium text-kora-black" : "text-right text-muted-foreground"}>
        {value ?? "No registrado"}
      </span>
    </div>
  );
}

export function CustomerSheet({
  customer,
  metrics,
  top,
  whatsapp,
  backTo,
}: {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    country: string;
    city: string | null;
    address: string | null;
    pointsBalance: number;
  };
  metrics: CustomerMetrics;
  top: TopCategory[];
  whatsapp: string | null;
  backTo: string;
}) {
  const router = useRouter();
  const close = () => router.push(backTo);

  const moneda = metrics.primary?.currency ?? (customer.country === "US" ? "USD" : "COP");
  // La cuenta del comprador (módulo ACC) todavía no existe: hoy todos son
  // invitados. Se muestra igual para que el dato exista desde el día uno.
  const tieneCuenta = false;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(14,15,18,0.5)]" onClick={close}>
      <div
        className="flex h-full w-[440px] max-w-full flex-col overflow-y-auto bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#f0ece6] bg-white px-6 py-5">
          <h2 className="text-lg font-bold text-kora-black">Perfil del cliente</h2>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="flex size-[34px] items-center justify-center rounded-full bg-[#f5f3f0] text-[#8a8f98] hover:text-kora-black"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex-1 space-y-5 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="bg-kora-gradient flex size-12 items-center justify-center rounded-full text-sm font-bold text-white">
              {iniciales(customer.name)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[17px] font-bold text-kora-black">{customer.name}</div>
              <span
                className={
                  tieneCuenta
                    ? "inline-block rounded-full bg-[#f0ece6] px-2 py-0.5 text-[11px] font-semibold text-kora-black"
                    : "inline-block rounded-full bg-[#f4f2ef] px-2 py-0.5 text-[11px] font-semibold text-[#8a8f98]"
                }
              >
                {tieneCuenta ? "Con cuenta" : "Invitado"}
              </span>
            </div>
          </div>

          <div className="rounded-[12px] border border-[#eee9e2] px-4 py-2">
            <Dato label="WhatsApp" value={customer.phone} />
            <Dato label="Email" value={customer.email} />
            <Dato
              label="Última dirección"
              value={
                [customer.address, customer.city].filter(Boolean).join(", ") || null
              }
            />
            <Dato
              label="País · moneda"
              value={`${customer.country} · ${customer.country === "US" ? "USD" : "COP"}`}
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Metrica label="Pedidos" value={String(metrics.orders)} />
            <Metrica
              label="Inactivo"
              value={metrics.inactiveDays === null ? "—" : `${metrics.inactiveDays} d`}
              hint={metrics.inactiveDays === null ? "Sin pedidos" : undefined}
            />
            <Metrica
              label="Ticket promedio"
              value={metrics.primary ? money(metrics.primary.avg, metrics.primary.currency) : money(0, moneda)}
              // Las monedas NO se suman: si hay pedidos en la otra, se dicen
              // aparte. No existe tasa de cambio en KORA y es deliberado.
              hint={
                metrics.others.length > 0
                  ? metrics.others
                      .map((o) => `+ ${o.orders} pedido${o.orders === 1 ? "" : "s"} en ${o.currency}`)
                      .join(" · ")
                  : undefined
              }
            />
          </div>

          {/* Saldo de fidelización. Mientras Kora Cashback no exista muestra 0
              sin error, como pide CLI_HU002 — el hueco queda listo. */}
          <div className="flex items-center gap-2.5 rounded-[12px] border border-[#ffd9c7] bg-[linear-gradient(120deg,#FFF4EF,#fff)] px-4 py-3.5">
            <KoraFlame className="size-6" />
            <div>
              <div className="text-[17px] font-extrabold text-kora-black">
                {customer.pointsBalance}
              </div>
              <div className="text-[11px] tracking-wide text-muted-foreground uppercase">
                Saldo de fidelización
              </div>
            </div>
          </div>

          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-kora-gradient flex w-full items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white"
            >
              <MessageCircle className="size-4" /> Chatear por WhatsApp
            </a>
          ) : (
            <div className="rounded-[10px] bg-[#f5f3f0] py-3 text-center text-sm text-muted-foreground">
              Sin número de WhatsApp registrado
            </div>
          )}

          <div>
            <h3 className="mb-2 text-[13px] font-bold text-kora-black">
              Top 5 de categorías que más compra
            </h3>
            {top.length === 0 ? (
              <p className="rounded-[12px] bg-[#fbfaf8] px-4 py-5 text-center text-sm text-muted-foreground">
                Aún no tiene compras confirmadas
              </p>
            ) : (
              <ol className="space-y-1.5">
                {top.map((c, i) => (
                  <li
                    key={c.categoryId}
                    className="flex items-center gap-3 rounded-[10px] border border-[#f0ece6] px-3.5 py-2.5"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-[#f4f2ef] text-[11px] font-bold text-[#6b6f78]">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-kora-black">
                      {c.categoryName}
                    </span>
                    <span className="text-right text-[12px] text-muted-foreground">
                      {c.units} u · {money(c.spent, moneda)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
