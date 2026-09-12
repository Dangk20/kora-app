import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail, Plus, Sparkles, UserPlus, Users } from "lucide-react";
import { emailUsage } from "@/modules/email/usage";
import { ConsumoDelPlan } from "./consumo";
import { auth } from "@/auth";
import { listCampaigns, recentCampaigns } from "@/modules/campaigns/queries";
import { STATUS_LABEL } from "@/modules/campaigns/status";
import { subscriberStats } from "@/modules/consent/subscription";
import { emailProviderConfigured } from "@/modules/email/config";
import { webhookSecret } from "@/modules/email/webhook";
import type { CampaignStatus } from "@/generated/prisma/enums";
import { RowActions } from "./row-actions";

const CHIPS: { key: CampaignStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Todas" },
  { key: "DRAFT", label: "Borradores" },
  { key: "SCHEDULED", label: "Programadas" },
  { key: "SENDING", label: "Enviando" },
  { key: "SENT", label: "Enviadas" },
  { key: "CANCELLED", label: "Canceladas" },
];

const BADGE: Record<CampaignStatus, string> = {
  DRAFT: "bg-[#f4f2ef] text-[#8a8f98]",
  SCHEDULED: "bg-[#eef3fa] text-[#2b4d7a]",
  SENDING: "bg-[#fff1e6] text-[#b25a12]",
  SENT: "bg-[#e8f6ec] text-[#1f7a3d]",
  CANCELLED: "bg-[#f4f2ef] text-[#8a8f98]",
};

const fecha = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(d) : "—";

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("marketing:view")) redirect("/admin");
  const puedeCrear = session.user.permissions.includes("marketing:create");
  const puedeEnviar = session.user.permissions.includes("marketing:send");

  const { estado = "ALL" } = await searchParams;
  const campañas = await listCampaigns();
  const filtradas = estado === "ALL" ? campañas : campañas.filter((c) => c.status === estado);

  const [contactos, usage, ultimas] = await Promise.all([
    subscriberStats(),
    emailUsage(),
    recentCampaigns(3),
  ]);
  const hayProveedor = emailProviderConfigured();
  const hayMetricas = webhookSecret() !== null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-kora-black">
            Email marketing
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Campañas a tu base de clientes</p>
        </div>
        {puedeCrear && (
          <Link
            href="/admin/campanas/editor"
            className="bg-kora-gradient flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> Crear campaña
          </Link>
        )}
      </div>

      {/* Sin proveedor no sale ni un correo. Decirlo arriba y con el motivo
          evita que el operador prepare una campaña creyendo que se enviará. */}
      {!hayProveedor && (
        <div className="mb-5 rounded-[12px] border border-[#ffd9c7] bg-[#FFF4EF] px-5 py-4">
          <p className="text-[13.5px] font-semibold text-kora-black">
            En este entorno el correo no sale a internet
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            No hay proveedor de envío configurado aquí: los correos se escriben en el servidor en
            vez de salir. Puedes preparar campañas y ver la vista previa igual. Las métricas de
            apertura y clic tampoco están disponibles hasta entonces.
          </p>
        </div>
      )}

      {/* ── Tarjetas: el estado del módulo de un vistazo ── */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Tus contactos" accion={{ href: "/admin/clientes", label: "Ir a clientes" }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Cifra valor={contactos.total} label="Suscritos que pueden recibir campañas" icono={<Users className="size-5" />} />
            <Cifra valor={contactos.nuevos30} label="Nuevos en los últimos 30 días" icono={<UserPlus className="size-5" />} tono="verde" />
          </div>
        </Tarjeta>

        {hayProveedor ? (
          <ConsumoDelPlan usage={usage} />
        ) : (
          <Tarjeta titulo="Consumo del plan de correo">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Se mide donde hay proveedor configurado. Aquí los correos van a disco y no consumen nada.
            </p>
          </Tarjeta>
        )}

        <Tarjeta titulo="Tus últimas campañas" accion={puedeCrear ? { href: "/admin/campanas/editor", label: "Crear campaña" } : undefined}>
          {ultimas.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Todavía no has enviado ninguna.</p>
          ) : (
            <ul className="divide-y divide-[#f0ece6]">
              {ultimas.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/admin/campanas/${c.id}`} className="block truncate text-[14px] font-semibold text-kora-black hover:text-kora-coral">
                      {c.name}
                    </Link>
                    <p className="text-[12px] text-muted-foreground">
                      {c.sentAt ? fecha(c.sentAt) : "enviando"} · {c.sentCount} enviado{c.sentCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-5 text-center">
                    <Tasa label="Apertura" valor={c.openRate} disponible={hayMetricas} />
                    <Tasa label="Clic" valor={c.clickRate} disponible={hayMetricas} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <div className="flex items-center gap-5 rounded-[14px] border border-[#eee9e2] bg-white p-6">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-[#FFE9DD] text-kora-coral">
            <Sparkles className="size-7" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-kora-black">Compón el correo como lo vas a ver</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Bloques de título, texto, imagen, botón y productos, con la vista previa del correo
              actualizándose mientras escribes.
            </p>
            {puedeCrear && (
              <Link href="/admin/campanas/editor" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-kora-coral">
                Abrir el constructor <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <Link
            key={c.key}
            href={c.key === "ALL" ? "/admin/campanas" : `/admin/campanas?estado=${c.key}`}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${
              estado === c.key
                ? "border-kora-coral bg-kora-coral/10 text-kora-coral"
                : "border-[#e2ddd6] text-[#6b6f78]"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#eee9e2] bg-white">
        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Mail className="size-7 text-[#c9c3ba]" />
            <p className="text-[14px] text-muted-foreground">
              {campañas.length === 0
                ? "Todavía no has creado ninguna campaña."
                : "No hay campañas en este estado."}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-[13.5px]">
            <thead className="border-b border-[#f0ece6] text-[11.5px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-3">Campaña</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Audiencia</th>
                <th className="px-5 py-3 text-right">Destinatarios</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Resultado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr key={c.id} className="border-b border-[#f6f3ef] last:border-0">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/campanas/${c.id}`} className="font-semibold text-kora-black">
                      {c.name}
                    </Link>
                    <div className="text-[12px] text-muted-foreground">{c.subject}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${BADGE[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.segmentLabel}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="font-semibold text-kora-black">{c.recipients}</span>
                    {/* En borrador el número cambia con los filtros y con quien
                        se suscribe: decirlo evita leerlo como compromiso. */}
                    {c.recipientsAreEstimate && (
                      <span className="ml-1 text-[11.5px] text-muted-foreground">est.</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{fecha(c.date)}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {c.status === "SENT" || c.status === "SENDING" ? (
                      <>
                        {c.sentCount} enviado{c.sentCount === 1 ? "" : "s"}
                        {c.failedCount > 0 && (
                          <span className="text-[#b25a12]"> · {c.failedCount} fallido(s)</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <RowActions
                      id={c.id}
                      status={c.status}
                      editHref={`/admin/campanas/editor?id=${c.id}`}
                      puedeCrear={puedeCrear}
                      puedeEnviar={puedeEnviar}
                      recipients={c.recipients}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </>
  );
}


function Tarjeta({ titulo, accion, children }: {
  titulo: string;
  accion?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-[#eee9e2] bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-kora-black">{titulo}</h2>
        {accion && (
          <Link href={accion.href} className="text-[13px] font-semibold text-kora-coral hover:underline">
            {accion.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Cifra({ valor, label, icono, tono = "neutro" }: {
  valor: number; label: string; icono: React.ReactNode; tono?: "neutro" | "verde";
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[12px] border border-[#eee9e2] p-4">
      <div>
        <div className="text-[24px] leading-none font-extrabold text-kora-black tabular-nums">{valor.toLocaleString("es-CO")}</div>
        <div className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{label}</div>
      </div>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${tono === "verde" ? "bg-[#e8f6ec] text-[#1f7a3d]" : "bg-[#f5f3f0] text-[#6b6f78]"}`}>
        {icono}
      </span>
    </div>
  );
}

/** Una tasa que no se conoce se dice, no se pone en cero. */
function Tasa({ label, valor, disponible }: { label: string; valor: number | null; disponible: boolean }) {
  return (
    <div>
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="text-[17px] font-extrabold text-kora-black tabular-nums" title={!disponible ? "El proveedor no reporta métricas en este entorno" : undefined}>
        {valor === null ? <span className="text-[13px] font-semibold text-[#b3b8c0]">{disponible ? "—" : "n/d"}</span> : `${valor} %`}
      </div>
    </div>
  );
}
