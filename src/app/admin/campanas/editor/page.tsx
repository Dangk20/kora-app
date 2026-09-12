import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { blocksFromLegacy, parseBlocks, type Block } from "@/modules/campaigns/blocks";
import { isEditable } from "@/modules/campaigns/status";
import { SEGMENTO_VACIO, type Segment } from "@/modules/campaigns/types";
import { storage } from "@/modules/storage";
import { Builder } from "./builder";

export const metadata = { title: "Constructor de campaña · KORA" };

/**
 * El constructor, a pantalla completa. Nueva campaña sin `id`; editar con
 * `?id=`. Una campaña que ya salió no se abre aquí: se duplica.
 */
export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("marketing:create")) redirect("/admin/campanas");

  const { id } = await searchParams;
  const campaign = id ? await db.campaign.findUnique({ where: { id } }) : null;
  if (id && !campaign) notFound();
  if (campaign && !isEditable(campaign.status)) redirect(`/admin/campanas/${campaign.id}`);

  // Una campaña anterior a los bloques se convierte AL ABRIRLA, no por
  // migración: no hay que tocar datos que ya funcionan.
  const bloques: Block[] = campaign
    ? (parseBlocks(campaign.blocks) ?? blocksFromLegacy(campaign))
    : [];

  // Lo que el constructor necesita saber de lo que ya referencia: nombres de
  // productos y direcciones de imágenes. Todo lo demás lo busca al vuelo.
  const idsProductos = [...new Set(bloques.flatMap((b) => (b.type === "products" ? b.productIds : [])))];
  const productos = idsProductos.length
    ? await db.product.findMany({ where: { id: { in: idsProductos } }, select: { id: true, name: true } })
    : [];
  const imagenes: Record<string, string> = {};
  for (const b of bloques) {
    if (b.type === "image" && b.imageKey) imagenes[b.imageKey] = storage().urlFor(b.imageKey);
  }

  const categorias = await db.category.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="-mx-8 -mt-7 -mb-14 flex min-h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-[#eee9e2] bg-white px-6 py-3">
        <Link
          href={campaign ? `/admin/campanas/${campaign.id}` : "/admin/campanas"}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-kora-black"
        >
          <ArrowLeft className="size-4" /> Campañas
        </Link>
      </div>
      <Builder
        campaign={
          campaign
            ? {
                id: campaign.id,
                name: campaign.name,
                subject: campaign.subject,
                preheader: campaign.preheader ?? "",
                segment: (campaign.segment as unknown as Segment) ?? SEGMENTO_VACIO,
              }
            : null
        }
        initialBlocks={bloques}
        productNames={Object.fromEntries(productos.map((p) => [p.id, p.name]))}
        imageUrls={imagenes}
        categorias={categorias}
      />
    </div>
  );
}
