// Exporta las tres páginas legales a Markdown, para que el cliente las apruebe.
//
// Existe por la misma razón que `pnpm emails:preview`: es más fácil que el
// cliente priorice un insumo cuando ve exactamente qué está frenando. Aquí, lo
// que está frenando es su razón social, su NIT, su domicilio y un correo de
// contacto — sin ellos la aplicación no arranca en producción.
//
//   pnpm legal:export
//
// Escribe en .legal/ (ignorado por git, igual que .emails/).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { merchant } from "../src/modules/legal/config";
import { allLegalDocuments } from "../src/modules/legal/content";

const DESTINO = join(process.cwd(), ".legal");

function aMarkdown(doc: ReturnType<typeof allLegalDocuments>[number]): string {
  const lineas: string[] = [`# ${doc.title}`, "", `_${doc.summary}_`, ""];
  lineas.push(`**Última actualización:** ${doc.updatedAt}`, "");

  for (const section of doc.sections) {
    lineas.push(`## ${section.heading}`, "");
    for (const block of section.blocks) {
      if (block.kind === "list") {
        for (const item of block.items) lineas.push(`- ${item}`);
        lineas.push("");
      } else if (block.kind === "note") {
        lineas.push(`> ${block.text}`, "");
      } else {
        lineas.push(block.text, "");
      }
    }
  }

  return lineas.join("\n");
}

function main(): void {
  mkdirSync(DESTINO, { recursive: true });

  const m = merchant();
  const documentos = allLegalDocuments(m);

  for (const doc of documentos) {
    const ruta = join(DESTINO, `${doc.slug}.md`);
    writeFileSync(ruta, aMarkdown(doc), "utf8");
    console.log(`✓ ${ruta}`);
  }

  if (m.incompleto) {
    console.log(
      "\n⚠ Los datos del comerciante están sin llenar y salen como marcadores.\n" +
        "  Faltan por pedirle al cliente: razón social, NIT, domicilio y correo de\n" +
        "  atención al titular de datos (KORA_LEGAL_*). Sin ellos la aplicación NO\n" +
        "  ARRANCA en producción, y es a propósito.\n",
    );
  }

  console.log(
    "Pendiente de decisión del cliente: la política de cambios publica su plazo de\n" +
      "30 días Y, en secciones aparte, el derecho de retracto (5 días hábiles) y la\n" +
      "garantía legal. Su documento decía \"KORA no realiza devoluciones de dinero\",\n" +
      "que no se puede publicar en una tienda online colombiana (Ley 1480/2011).\n" +
      "Necesita su visto bueno explícito antes del go-live.\n",
  );
}

main();
