import { redirect } from "next/navigation";
import Link from "next/link";
import { Mail, Plus, Users } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listCampaigns } from "@/modules/campaigns/queries";
import { STATUS_LABEL } from "@/modules/campaigns/status";
import { subscriberCount } from "@/modules/consent/subscription";
import { emailProviderConfigured } from "@/modules/email/config";
import type { CampaignStatus } from "@/generated/prisma/enums";
import { CampaignForm } from "./campaign-form";
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
  searchParams: Promise<{ estado?: string; nueva?: string; editar?: string }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("marketing:view")) redirect("/admin");
  const puedeCrear = session.user.permissions.includes("marketing:create");
  const puedeEnviar = session.user.permissions.includes("marketing:send");

  const { estado = "ALL", nueva, editar } = await searchParams;
  const campañas = await listCampaigns();
  const filtradas = estado === "ALL" ? campañas : campañas.filter((c) => c.status === estado);

  const [suscritos, categorias, productos] = await Promise.all([
    subscriberCount(),
    db.category.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 200,
    }),
  ]);

  const editando = editar
    ? await db.campaign.findUnique({ where: { id: editar } })
    : null;

  const href = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (estado !== "ALL") p.set("estado", estado);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    const q = p.toString();
    return `/admin/campanas${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-kora-black">
            Email marketing
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
            <Users className="size-4" />
            <strong className="text-kora-black">{suscritos}</strong> suscrito
            {suscritos === 1 ? "" : "s"} pueden recibir campañas
          </p>
        </div>
        {puedeCrear && (
          <Link
            href={href({ nueva: "1" })}
            className="bg-kora-gradient flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> Crear campaña
          </Link>
        )}
      </div>

      {/* Sin proveedor no sale ni un correo. Decirlo arriba y con el motivo
          evita que el operador prepare una campaña creyendo que se enviará. */}
      {!emailProviderConfigured() && (
        <div className="mb-5 rounded-[12px] border border-[#ffd9c7] bg-[#FFF4EF] px-5 py-4">
          <p className="text-[13.5px] font-semibold text-kora-black">
            El envío de correo todavía no está activo
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Falta configurar el proveedor y publicar los registros de correo del dominio
            (SPF, DKIM y DMARC). Puedes preparar campañas y ver la vista previa; los envíos
            quedan guardados en el servidor en vez de salir. Las métricas de apertura y clic
            tampoco están disponibles hasta entonces.
          </p>
        </div>
      )}

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
                      editHref={href({ editar: c.id })}
                      puedeCrear={puedeCrear}
                      puedeEnviar={puedeEnviar}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(nueva || editando) && puedeCrear && (
        <CampaignForm
          campaign={
            editando
              ? {
                  id: editando.id,
                  name: editando.name,
                  subject: editando.subject,
                  preheader: editando.preheader ?? "",
                  title: editando.title,
                  body: editando.body,
                  ctaLabel: editando.ctaLabel ?? "",
                  ctaUrl: editando.ctaUrl ?? "",
                  productIds: editando.productIds,
                  segment: editando.segment as never,
                }
              : null
          }
          categorias={categorias}
          productos={productos}
          backTo={href({})}
        />
      )}
    </>
  );
}
