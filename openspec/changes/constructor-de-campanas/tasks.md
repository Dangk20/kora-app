## 1. Modelo y render

- [x] 1.1 `Campaign.blocks Json?` y migración
- [x] 1.2 `campaigns/blocks.ts`: tipos, validación, `blocksFromLegacy`, derivados, texto plano
- [x] 1.3 `template.ts`: render de bloques (HTML y texto) compartiendo cabecera, saludo y pie
- [x] 1.4 `content.ts` y `actions.ts`: guardar bloques, derivar los fijos, acción de vista previa sin guardar

## 2. Constructor

- [x] 2.1 Ruta `/admin/campanas/editor` a pantalla completa
- [x] 2.2 Paleta de bloques y edición del bloque elegido (subir, bajar, quitar)
- [x] 2.3 Vista previa en vivo en iframe con escritorio/móvil
- [x] 2.4 Ajustes de campaña (nombre, asunto, preheader, audiencia) y prueba de envío en el mismo constructor

## 3. Panel y modal

- [x] 3.1 Tarjetas: contactos, consumo, últimas campañas con tasas
- [x] 3.2 Modal de confirmación con el paso de cupo parcial
- [x] 3.3 Texto del aviso "no está activo" sin SPF/DKIM/DMARC

## 4. Cierre

- [x] 4.1 Pruebas: conversión de campos fijos a bloques, validación, render de bloques, derivados
- [x] 4.2 typecheck, lint, pruebas del módulo
