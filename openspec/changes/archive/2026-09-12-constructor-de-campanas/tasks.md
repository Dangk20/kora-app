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

## 5. Refinamiento tras la primera prueba de Daniel (12 sep)

- [x] 5.1 Los bloques se arrastran: de la paleta al lienzo y dentro del lienzo para reordenar, con zonas de caída visibles; las flechas siguen para quien no arrastra
- [x] 5.2 El constructor es un flujo por pasos como el alta de producto: 1) la campaña y a quién va, 2) el diseño con el correo a la vista, 3) revisar, probar y enviar o programar
- [x] 5.3 Vista previa en claro y en oscuro desde el mismo HTML: el iframe hereda el modo del sistema, y con macOS en oscuro el operador creía que el correo "salía negro"
- [x] 5.4 El modal de envío es un componente compartido entre el listado y el paso 3
