// Descarga de la plantilla de importación. La misma plantilla que se le
// envía al cliente por WhatsApp vive aquí: una sola fuente de verdad.
import { auth } from "@/auth";
import { buildCatalogTemplate } from "@/modules/catalog/import/template";

export async function GET() {
  const session = await auth();
  if (!session?.user.permissions.includes("catalog:view")) {
    return new Response("No autorizado", { status: 403 });
  }
  const buffer = await buildCatalogTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-catalogo-kora.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
