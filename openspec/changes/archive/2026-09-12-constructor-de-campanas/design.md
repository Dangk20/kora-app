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

## Añadido el 12 sep tras la primera prueba

**Arrastrar y soltar del navegador, sin librería.** Cuatro eventos (`dragstart`,
`dragover`, `drop`, `dragend`) y dos tipos MIME propios para que un arrastre
ajeno —un archivo, un texto— no caiga en el lienzo. El lienzo es la lista de
bloques, no el iframe: no se puede soltar dentro de otro documento. Las flechas
se conservan para teclado.

**Tres pasos, no una pantalla.** Es la experiencia del alta de producto: qué y
a quién → cómo se ve → revisar y decidir. El borrador se guarda al pasar del
diseño a la revisión, para que el último paso tenga una campaña real sobre la
que enviar o programar; en una nueva, eso crea el registro y el constructor se
queda sobre ella con `?id=&paso=3`.

**Claro y oscuro desde el mismo HTML.** El iframe hereda `prefers-color-scheme`
del sistema de quien mira. Claro = la regla `@media (prefers-color-scheme: dark)`
pasa a `@media not all`; oscuro = a `@media all`. No hay dos renders.
