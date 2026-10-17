import Link from "next/link";
import { ACTION_ICON } from "../_components/action-icon";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Layers, SlidersHorizontal } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CategoryTile } from "@/modules/catalog/tiles";
import { categoryIdFilter } from "@/modules/catalog/category-filter";
import { storage } from "@/modules/storage";
import { StockSheet } from "./stock-sheet";
import { CatalogToolbar } from "../catalogo/catalog-toolbar";
import { Pagination } from "../_components/pagination";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    ajustar?: string;
    q?: string;
    categoria?: string;
    sub?: string;
    estado?: string;
    orden?: string;
    dir?: string;
    por?: string;
    pagina?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("inventory:view")) redirect("/admin");
  const canAdjust = session.user.permissions.includes("inventory:adjust");
  const sp = await searchParams;
  const { ajustar, q, categoria, estado } = sp;

  const perPage = [20, 50, 100].includes(Number(sp.por)) ? Number(sp.por) : 20;
  const page = Math.max(1, Number(sp.pagina) || 1);

  // El inventario mira VARIANTES, no productos: es donde vive el stock. Los
  // retirados quedan fuera, igual que en el catálogo — no tiene sentido
  // ajustarle unidades a algo que ya no se vende.
  const where: Record<string, unknown> = {
    active: true,
    product: { active: true, archivedAt: null },
  };

  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { sku: { contains: term, mode: "insensitive" } },
      // El código de barras también: quien escanea espera encontrar.
      { barcode: { contains: term, mode: "insensitive" } },
      { name: { contains: term, mode: "insensitive" } },
      { product: { name: { contains: term, mode: "insensitive" } } },
    ];
  }
  const filtroCategoria = await categoryIdFilter(categoria, sp.sub);
  if (filtroCategoria) {
    where.product = { ...(where.product as object), categoryId: filtroCategoria };
  }
  // Filtros propios del inventario: aquí "estado" no es activo/inactivo —eso
  // es del catálogo—, es en qué situación está el stock.
  if (estado === "bajo") where.stockActual = { lte: db.variant.fields.stockMin };
  if (estado === "agotado") where.stockActual = 0;
  if (estado === "sin-publicar") where.onlineUnits = 0;
  if (estado === "con-stock") where.stockActual = { gt: 0 };

  // Orden por columna (?orden=&dir=), clic en el título. "Física" no es una
  // columna de la base (stock total − cupo online): para ella se ordenan los
  // ids en memoria, que con unos cientos de variantes no pesa.
  const orden = ORDENES.includes(sp.orden as Orden) ? (sp.orden as Orden) : null;
  const dir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  const porNombre = [{ product: { name: "asc" as const } }, { name: "asc" as const }];
  const orderBy =
    orden === "producto" ? [{ product: { name: dir } }, { name: dir }]
    : orden === "categoria" ? [{ product: { category: { name: dir } } }, ...porNombre]
    : orden === "online" ? [{ onlineUnits: dir }, ...porNombre]
    : orden === "total" ? [{ stockActual: dir }, ...porNombre]
    : orden === "alerta" ? [{ stockMin: dir }, ...porNombre]
    : porNombre;
  const incluir = {
    product: {
      include: {
        category: true,
        images: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
      },
    },
  };

  const paginaDeVariantes = async () => {
    if (orden !== "fisica") {
      return db.variant.findMany({ where, include: incluir, orderBy, skip: (page - 1) * perPage, take: perPage });
    }
    const todas = await db.variant.findMany({
      where,
      select: { id: true, stockActual: true, onlineUnits: true },
      orderBy: porNombre,
    });
    const signo = dir === "asc" ? 1 : -1;
    const ids = todas
      .sort((a, b) => signo * ((a.stockActual - a.onlineUnits) - (b.stockActual - b.onlineUnits)))
      .slice((page - 1) * perPage, page * perPage)
      .map((v) => v.id);
    const filas = await db.variant.findMany({ where: { id: { in: ids } }, include: incluir });
    return ids.map((id) => filas.find((f) => f.id === id)!);
  };

  const [total, variants, categories, lowCount] = await Promise.all([
    db.variant.count({ where }),
    paginaDeVariantes(),
    db.category.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true, parentId: true },
    }),
    // El contador de alerta cuenta SOBRE TODO el inventario, no sobre la
    // página: "3 con stock bajo" tiene que significar tres en la tienda, no
    // tres entre los veinte que estás viendo.
    db.variant.count({
      where: {
        active: true,
        product: { active: true, archivedAt: null },
        stockActual: { lte: db.variant.fields.stockMin },
      },
    }),
  ]);

  // Slide-over de ajuste controlado por URL (?ajustar=<variantId>)
  // Se busca en la base, no en la página: con paginación, la variante que se
  // está ajustando puede no estar entre las veinte que se ven.
  const adjusting = ajustar
    ? ((await db.variant.findUnique({
        where: { id: ajustar },
        include: { product: { include: { category: true } } },
      })) ?? undefined)
    : undefined;
  const movements = adjusting
    ? await db.stockMovement.findMany({
        where: { variantId: adjusting.id },
        include: { actor: true, order: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];

  return (
    <>
      {/* Banner explicativo del prototipo */}
      <div className="mb-4 flex items-center gap-3 rounded-[14px] border border-[#ffd9c7] bg-[linear-gradient(120deg,#FFF4EF,#fff)] px-5 py-4">
        <span className="bg-kora-coral flex size-[38px] shrink-0 items-center justify-center rounded-[10px] text-white">
          <Layers className="size-5" strokeWidth={1.8} />
        </span>
        <p className="text-[13px] leading-relaxed text-[#6b4a3a]">
          <span className="font-bold text-kora-black">Inventario unificado.</span>{" "}
          El stock es uno solo: la tienda online y el punto de venta físico venden
          del mismo inventario. Toda venta o ajuste queda registrado en el libro de
          movimientos — nada cambia el stock por fuera de él.
        </p>
      </div>

      {lowCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl bg-[#fce8e8] px-5 py-3 text-[13px] font-semibold text-[#b3373b]">
          <Layers className="size-[18px]" strokeWidth={1.8} />
          {lowCount} variante(s) con stock en o por debajo de su alerta requieren
          reposición.
          {/* Enlace directo al filtro: el aviso dice cuántas, y esto lleva a
              verlas. Sin él hay que leer el número y buscarlas a mano. */}
          <Link
            href="/admin/inventario?estado=bajo"
            className="ml-auto rounded-full bg-white/70 px-3 py-1 text-[12px] font-bold hover:bg-white"
          >
            Ver solo esas
          </Link>
        </div>
      )}

      <CatalogToolbar
        basePath="/admin/inventario"
        total={total}
        sustantivo={["variante", "variantes"]}
        buscarEn="Buscar por producto, variante, SKU o código de barras…"
        categories={categories}
        // Aquí "estado" es la situación del STOCK, no activo/inactivo: eso es
        // del catálogo, y en inventario todo lo que se ve está activo.
        estados={[
          { value: "bajo", label: "Stock bajo" },
          { value: "agotado", label: "Agotados" },
          { value: "con-stock", label: "Con stock" },
          { value: "sin-publicar", label: "Sin publicar online" },
        ]}
      />

      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[2.2fr_0.9fr_0.7fr_0.7fr_0.8fr_0.6fr_0.5fr] gap-3.5 border-b border-[#f0ece6] px-6 py-4 text-[11.5px] font-bold tracking-wide text-[#9aa0ab] uppercase">
          <Encabezado columna="producto" sp={sp}>Producto · SKU</Encabezado>
          <Encabezado columna="categoria" sp={sp}>Categoría</Encabezado>
          <Encabezado columna="online" sp={sp} derecha>Online</Encabezado>
          <Encabezado columna="fisica" sp={sp} derecha>Física</Encabezado>
          <Encabezado columna="total" sp={sp} derecha>Stock total</Encabezado>
          <Encabezado columna="alerta" sp={sp} derecha>Alerta</Encabezado>
          <span />
        </div>
        {variants.map((v) => {
          const low = v.stockActual <= v.stockMin;
          return (
            <div
              key={v.id}
              className="grid grid-cols-[2.2fr_0.9fr_0.7fr_0.7fr_0.8fr_0.6fr_0.5fr] items-center gap-3.5 border-b border-[#f7f4f0] px-6 py-3.5 text-[13px] hover:bg-[#faf8f5]"
            >
              <div className="flex min-w-0 items-center gap-3">
                {v.product.images[0] ? (
                  // Foto del producto (sin recortar: object-contain). Sin
                  // foto, el tile de la categoría como antes.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={storage().urlFor(v.product.images[0].url)}
                    alt=""
                    loading="lazy"
                    className="size-[42px] shrink-0 rounded-[10px] border border-[#f0ece6] bg-white object-contain p-0.5"
                  />
                ) : (
                  <CategoryTile
                    color={v.product.category.color}
                    icon={v.product.category.icon}
                    size={42}
                  />
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold text-kora-black">
                    {v.product.name}
                    {v.name !== "Única" && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {v.name}
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-[#9aa0ab]">SKU {v.sku}</div>
                </div>
              </div>
              <span className="text-muted-foreground">{v.product.category.name}</span>
              <span className="text-right font-semibold text-kora-coral">
                {v.onlineUnits}
              </span>
              <span className="text-right font-semibold text-[#8a5cb0]">
                {v.stockActual - v.onlineUnits}
              </span>
              <span
                className="text-right text-[15px] font-bold"
                style={{ color: low ? "#E5484D" : "#16181D" }}
              >
                {v.stockActual}
              </span>
              <span className="text-right text-muted-foreground">≤ {v.stockMin}</span>
              {canAdjust ? (
                <Link
                  href={`/admin/inventario?ajustar=${v.id}`}
                  aria-label={`Ajustar stock de ${v.product.name} · ${v.name}`}
                  title="Ajustar stock"
                  className={`${ACTION_ICON} justify-self-end`}
                >
                  {/* Icono, como en Productos: en una tabla de números, un
                      botón con texto en cada fila pesa más que los datos. */}
                  <SlidersHorizontal className="size-[15px]" />
                </Link>
              ) : (
                <span />
              )}
            </div>
          );
        })}
        {variants.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {q || categoria || sp.sub || estado
              ? "Ningún artículo coincide con lo que buscas."
              : "No hay variantes activas todavía."}
          </p>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / perPage))}
        perPage={perPage}
        total={total}
        params={sp}
        basePath="/admin/inventario"
      />

      {adjusting && canAdjust && (
        <StockSheet
          variant={{
            id: adjusting.id,
            productName: adjusting.product.name,
            variantName: adjusting.name,
            sku: adjusting.sku,
            stockActual: adjusting.stockActual,
            onlineUnits: adjusting.onlineUnits,
            stockMin: adjusting.stockMin,
            color: adjusting.product.category.color,
            icon: adjusting.product.category.icon,
          }}
          movements={movements.map((m) => ({
            id: m.id,
            delta: m.delta,
            reason: m.reason,
            channel: m.channel,
            actor: m.actor?.name ?? "Sistema",
            orderNumber: m.order?.number ?? null,
            note: m.note,
            createdAt: m.createdAt.toLocaleString("es-CO", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
          }))}
        />
      )}
    </>
  );
}

const ORDENES = ["producto", "categoria", "online", "fisica", "total", "alerta"] as const;
type Orden = (typeof ORDENES)[number];

/**
 * Título de columna que ordena. Primer clic: los números de mayor a menor
 * (lo que se busca al revisar stock) y los textos de la A a la Z; segundo
 * clic, al revés. Conserva búsqueda, filtros y tamaño de página.
 */
function Encabezado({
  columna,
  sp,
  derecha = false,
  children,
}: {
  columna: Orden;
  sp: Record<string, string | undefined>;
  derecha?: boolean;
  children: React.ReactNode;
}) {
  const activa = sp.orden === columna;
  const esTexto = columna === "producto" || columna === "categoria";
  const dirActual = sp.dir === "asc" ? "asc" : "desc";
  const siguiente = activa ? (dirActual === "asc" ? "desc" : "asc") : esTexto ? "asc" : "desc";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && k !== "pagina" && k !== "ajustar") params.set(k, v);
  params.set("orden", columna);
  params.set("dir", siguiente);
  const Icono = !activa ? ArrowUpDown : dirActual === "asc" ? ArrowUp : ArrowDown;
  return (
    <Link
      href={`/admin/inventario?${params}`}
      className={`flex items-center gap-1 uppercase hover:text-kora-black ${derecha ? "justify-end" : ""} ${activa ? "text-kora-black" : ""}`}
      title={activa ? (dirActual === "asc" ? "De menor a mayor" : "De mayor a menor") : "Ordenar"}
    >
      {children}
      <Icono className={`size-3.5 ${activa ? "text-kora-coral" : "opacity-40"}`} />
    </Link>
  );
}
