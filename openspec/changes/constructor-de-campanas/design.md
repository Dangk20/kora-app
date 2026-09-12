## Decisions

**Bloques como JSON en la campaña, campos fijos conservados.** `blocks Json?`
al lado de `title`, `body`, `ctaLabel`… Los fijos siguen existiendo porque los
leen el render de las campañas viejas y `sentHtml`; al guardar una campaña con
bloques se derivan (`title` = primer título, `body` = textos unidos) para que
nada que lea esos campos se rompa. Una campaña sin `blocks` se convierte a
bloques **al abrirla**, no por migración: no hay que tocar datos que ya
funcionan.

**El render de bloques vive en `template.ts`**, junto al de campos fijos, y
comparte cabecera, saludo y pie. La vista previa del constructor llama a
`renderCampaignFor` con el contenido sin guardar: es literalmente la función
del envío.

**La vista previa va en un `iframe srcDoc`**, no en un `div`: el HTML del
correo lleva su propio `<style>` y sus tablas, y dentro del panel heredaría
Tailwind. Se re-renderiza en servidor con un pequeño retraso tras el último
cambio (400 ms), para no pedir un render por tecla.

**Reordenar con flechas, no arrastrando.** Es lo que hace Vitrina y basta
para 5–10 bloques; arrastrar es una dependencia y un mes de detalles de
accesibilidad para un beneficio que el operador no ha pedido.

**Los productos se eligen con el mismo selector de Vitrina** (`product-picker`),
que ya sabe buscar y limitar.

**El modal usa `Dialog` de shadcn**, como el retiro de productos: el patrón ya
existe en el panel.
