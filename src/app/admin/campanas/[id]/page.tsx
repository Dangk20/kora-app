import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { campaignDetail } from "@/modules/campaigns/queries";
import { STATUS_LABEL } from "@/modules/campaigns/status";
import { ScheduleForm } from "./schedule-form";

export const metadata = { title: "Campaña · KORA" };

const fecha = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" }).format(d) : "—";

function Metrica({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[12px] border border-[#eee9e2] px-4 py-3">
      <div className="text-[20px] font-extrabold text-kora-black">{value}</div>
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default async function CampanaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("marketing:view")) redirect("/admin");
  const puedeEnviar = session.user.permissions.includes("marketing:send");

  const { id } = await params;
  const c = await campaignDetail(id);
  if (!c) notFound();

  const enCurso = c.status === "SENDING";
  const progreso = c.recipients > 0 ? Math.round(((c.sent + c.failed + c.skipped) / c.recipients) * 100) : 0;

  return (
    <>
      <Link href="/admin/campanas" className="text-[13px] text-muted-foreground underline">
        ← Volver a campañas
      </Link>

      <div className="mt-3 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-kora-black">{c.name}</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            {STATUS_LABEL[c.status]} · {c.segmentLabel}
            {c.scheduledAt && ` · programada para ${fecha(c.scheduledAt)}`}
            {c.sentAt && ` · enviada el ${fecha(c.sentAt)}`}
          </p>
        </div>
        {c.status === "DRAFT" && puedeEnviar && <ScheduleForm campaignId={c.id} />}
      </div>

      {enCurso && (
        <div className="mb-5 rounded-[12px] border border-[#ffd9c7] bg-[#FFF4EF] px-5 py-4">
          <p className="text-[13.5px] font-semibold text-kora-black">
            Enviando — {progreso}% ({c.sent + c.failed + c.skipped} de {c.recipients})
          </p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            El envío se procesa por lotes fuera de la tienda. Puedes cerrar esta pantalla.
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica label="Destinatarios" value={String(c.recipients)} />
        <Metrica label="Enviados" value={String(c.sent)} />
        <Metrica
          label="Fallidos"
          value={String(c.failed)}
          hint={c.skipped > 0 ? `${c.skipped} omitidos por baja` : undefined}
        />
        <Metrica label="Bajas generadas" value={String(c.unsubscribeCount)} />
      </div>

      {/* Un cero en "aperturas" se lee como "nadie lo abrió", y sobre esa
          lectura se toman decisiones comerciales. Decir que todavía no se mide
          —y por qué— es información; un cero sería una afirmación falsa. */}
      {!c.providerMetricsAvailable && (
        <div className="mb-6 rounded-[12px] border border-[#e2ddd6] bg-[#f9f7f4] px-5 py-4">
          <p className="text-[13px] font-semibold text-kora-black">
            Aperturas, clics, entregas confirmadas y rebotes: no disponibles todavía
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            Esas métricas las reporta el proveedor de correo, que aún no está configurado. No se
            muestran en cero a propósito: un cero se leería como “nadie abrió el correo”.
          </p>
        </div>
      )}

      <section className="rounded-[14px] border border-[#eee9e2] bg-white p-6">
        <h2 className="mb-3 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
          {c.sentHtml ? "Contenido enviado" : "Contenido"}
        </h2>
        <dl className="mb-4 grid gap-1.5 text-[13.5px]">
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-muted-foreground">Asunto</dt>
            <dd className="font-semibold text-kora-black">{c.subject}</dd>
          </div>
          {c.preheader && (
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted-foreground">Preheader</dt>
              <dd className="text-kora-black">{c.preheader}</dd>
            </div>
          )}
        </dl>

        {/* Enviada: se muestra la COPIA INMUTABLE, no un render de ahora. Un
            producto que cambió de precio no puede alterar lo que ya salió. */}
        <iframe
          srcDoc={c.sentHtml ?? undefined}
          src={c.sentHtml ? undefined : `/admin/campanas/${c.id}/previa`}
          title="Contenido del correo"
          className="h-[560px] w-full rounded-[10px] border border-[#e2ddd6] bg-white"
        />
      </section>
    </>
  );
}
