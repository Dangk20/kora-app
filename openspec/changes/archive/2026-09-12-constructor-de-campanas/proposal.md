## Why

Daniel probó Email marketing en local (12 sep 2026) y comparó con Brevo. Tres
cosas no están a la altura de una reunión de aprobación:

1. La confirmación de envío es un `confirm()` del navegador: una caja gris de
   sistema en medio de un panel con identidad propia.
2. El panel principal es una lista con una línea de texto encima. Brevo abre
   con tarjetas —contactos, consumo del plan, últimas campañas con sus tasas—
   y eso es lo que el cliente espera ver.
3. El contenido de la campaña se escribe en un formulario de campos fijos
   (título, texto, botón, productos) en un panel lateral, y la vista previa
   solo aparece **después de guardar**. Brevo compone por **bloques** sobre una
   vista previa que cambia mientras escribes, y Vitrina ya funciona así en KORA.

## What Changes

- **Modal propio** para confirmar el envío, con el aviso de cupo parcial como
  segundo paso dentro del mismo modal.
- **Panel con tarjetas**: contactos (suscritos y nuevos en 30 días), consumo
  del plan, últimas campañas con tasas de apertura y clic cuando hay datos, y
  la lista debajo.
- **Constructor por bloques con vista previa en vivo**, a pantalla completa:
  a la izquierda los bloques (título, texto, imagen, botón, productos,
  separador, espacio) y las propiedades del bloque elegido; a la derecha el
  correo tal como saldrá, re-renderizado por el mismo camino que el envío al
  cambiar cualquier cosa, con vista de escritorio y de móvil.
- El texto del aviso "el envío no está activo" deja de citar SPF/DKIM/DMARC.

### Lo que no cambia

- El renderizado es UNO: la vista previa usa `renderCampaignFor`, el mismo del
  envío. El constructor no tiene su propia maqueta.
- Las campañas ya enviadas conservan su `sentHtml`; las existentes sin bloques
  se convierten a bloques al abrirlas, sin migración de datos.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `email-campaigns`: el contenido pasa a componerse por bloques; la vista
  previa es en vivo; el panel abre con tarjetas; la confirmación es un modal.

## Impact

- Esquema: `Campaign.blocks Json?`. Los campos fijos se conservan para las
  campañas viejas y como derivados (título = primer bloque de título).
- `campaigns/blocks.ts` (tipos, validación, conversión), `template.ts`
  (render de bloques), `content.ts`, `actions.ts` (guardar bloques, vista
  previa sin guardar).
- Rutas: `/admin/campanas/editor` (nueva y editar); `page.tsx` con tarjetas.
