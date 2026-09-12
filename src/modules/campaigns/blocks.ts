// Los bloques de una campaña: qué son, cómo se validan y cómo se convierten.
// Ver openspec/changes/constructor-de-campanas — specs/email-campaigns.
//
// ⚠️ ESTE ARCHIVO NO IMPORTA NADA. Lo consume el constructor en el navegador,
// igual que `types.ts`: traer Prisma o `node:fs` aquí lo metería en el paquete
// del cliente.
//
// Los bloques deciden SOLO lo que va en medio del correo. La cabecera de
// marca, el saludo y el pie legal no son bloques: son lo que la ley y la marca
// exigen, y no se pueden quitar ni reordenar.

export type Block =
  | { id: string; type: "title"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; imageKey: string | null; alt: string; linkUrl: string }
  | { id: string; type: "button"; label: string; url: string }
  | { id: string; type: "products"; productIds: string[] }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height: 16 | 32 | 48 };

export type BlockType = Block["type"];

export const BLOCK_LABEL: Record<BlockType, string> = {
  title: "Título",
  text: "Texto",
  image: "Imagen",
  button: "Botón",
  products: "Productos",
  divider: "Separador",
  spacer: "Espacio",
};

/** El orden en que se ofrecen en la paleta. */
export const BLOCK_TYPES: BlockType[] = ["title", "text", "image", "button", "products", "divider", "spacer"];

export const MAX_BLOCKS = 20;

let contador = 0;
export function newBlockId(): string {
  contador += 1;
  return `b${Date.now().toString(36)}${contador}`;
}

export function newBlock(type: BlockType): Block {
  const id = newBlockId();
  switch (type) {
    case "title":
      return { id, type, text: "" };
    case "text":
      return { id, type, text: "" };
    case "image":
      return { id, type, imageKey: null, alt: "", linkUrl: "" };
    case "button":
      return { id, type, label: "Ver la tienda", url: "" };
    case "products":
      return { id, type, productIds: [] };
    case "divider":
      return { id, type };
    case "spacer":
      return { id, type, height: 32 };
  }
}

/** Un bloque cuenta como "con contenido" si aporta algo al correo. */
export function blockHasContent(b: Block): boolean {
  switch (b.type) {
    case "title":
    case "text":
      return b.text.trim().length > 0;
    case "image":
      return Boolean(b.imageKey);
    case "button":
      return b.label.trim().length > 0 && b.url.trim().length > 0;
    case "products":
      return b.productIds.length > 0;
    case "divider":
    case "spacer":
      return false;
  }
}

export type BlockProblem = { blockId: string | null; message: string };

export function validateBlocks(blocks: Block[]): BlockProblem[] {
  const problemas: BlockProblem[] = [];
  if (blocks.length > MAX_BLOCKS) {
    problemas.push({ blockId: null, message: `Máximo ${MAX_BLOCKS} bloques.` });
  }
  if (!blocks.some(blockHasContent)) {
    problemas.push({ blockId: null, message: "El correo necesita al menos un bloque con contenido." });
  }
  for (const b of blocks) {
    if (b.type === "button") {
      const label = b.label.trim();
      const url = b.url.trim();
      if (label && !url) problemas.push({ blockId: b.id, message: "El botón necesita un enlace." });
      if (url && !/^https?:\/\//i.test(url)) {
        problemas.push({ blockId: b.id, message: "El enlace del botón tiene que empezar por http:// o https://." });
      }
    }
    if (b.type === "image" && b.linkUrl.trim() && !/^https?:\/\//i.test(b.linkUrl.trim())) {
      problemas.push({ blockId: b.id, message: "El enlace de la imagen tiene que empezar por http:// o https://." });
    }
  }
  return problemas;
}

/**
 * Los campos fijos que las campañas viejas —y `sentHtml`— siguen leyendo, derivados
 * de los bloques. Se escriben al guardar para que nada que los lea se rompa.
 */
export function deriveLegacyFields(blocks: Block[]): {
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  imageKey: string | null;
  productIds: string[];
} {
  const titulo = blocks.find((b) => b.type === "title" && b.text.trim());
  const textos = blocks.filter((b): b is Extract<Block, { type: "text" }> => b.type === "text");
  const boton = blocks.find((b): b is Extract<Block, { type: "button" }> => b.type === "button" && Boolean(b.url.trim()));
  const imagen = blocks.find((b): b is Extract<Block, { type: "image" }> => b.type === "image" && Boolean(b.imageKey));
  const productos = blocks.flatMap((b) => (b.type === "products" ? b.productIds : []));
  return {
    title: titulo && titulo.type === "title" ? titulo.text.trim() : "",
    body: textos.map((t) => t.text.trim()).filter(Boolean).join("\n\n"),
    ctaLabel: boton?.label.trim() || null,
    ctaUrl: boton?.url.trim() || null,
    imageKey: imagen?.imageKey ?? null,
    productIds: [...new Set(productos)],
  };
}

/**
 * Una campaña anterior a los bloques, convertida. El orden reproduce el de la
 * plantilla de campos fijos: imagen, título, texto, botón, productos — para
 * que abrirla a editar la muestre igual que como se veía.
 */
export function blocksFromLegacy(c: {
  title: string;
  body: string;
  imageKey?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  productIds: string[];
}): Block[] {
  const out: Block[] = [];
  if (c.imageKey) out.push({ id: newBlockId(), type: "image", imageKey: c.imageKey, alt: "", linkUrl: "" });
  if (c.title.trim()) out.push({ id: newBlockId(), type: "title", text: c.title.trim() });
  if (c.body.trim()) out.push({ id: newBlockId(), type: "text", text: c.body.trim() });
  if (c.ctaLabel && c.ctaUrl) out.push({ id: newBlockId(), type: "button", label: c.ctaLabel, url: c.ctaUrl });
  if (c.productIds.length > 0) out.push({ id: newBlockId(), type: "products", productIds: c.productIds });
  return out;
}

/** Lee lo guardado en la base sin confiar en su forma. */
export function parseBlocks(raw: unknown): Block[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Block[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object" || typeof (b as { type?: unknown }).type !== "string") continue;
    const o = b as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : newBlockId();
    const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
    switch (o.type) {
      case "title":
        out.push({ id, type: "title", text: str("text") });
        break;
      case "text":
        out.push({ id, type: "text", text: str("text") });
        break;
      case "image":
        out.push({ id, type: "image", imageKey: typeof o.imageKey === "string" ? o.imageKey : null, alt: str("alt"), linkUrl: str("linkUrl") });
        break;
      case "button":
        out.push({ id, type: "button", label: str("label"), url: str("url") });
        break;
      case "products":
        out.push({ id, type: "products", productIds: Array.isArray(o.productIds) ? o.productIds.filter((x): x is string => typeof x === "string") : [] });
        break;
      case "divider":
        out.push({ id, type: "divider" });
        break;
      case "spacer": {
        const h = o.height === 16 || o.height === 48 ? o.height : 32;
        out.push({ id, type: "spacer", height: h });
        break;
      }
    }
  }
  return out;
}

/** El correo en texto plano, para quien no ve HTML. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "title":
          return b.text.trim().toUpperCase();
        case "text":
          return b.text.trim();
        case "button":
          return b.label.trim() && b.url.trim() ? `${b.label.trim()}: ${b.url.trim()}` : "";
        case "divider":
          return "—";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
