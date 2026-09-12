## Decisions

**Un driver compuesto, no una condición dentro del de Resend.** `index.ts`
elige: en producción, Resend a secas; fuera de producción con proveedor y
lista, un driver que consulta la lista y delega en Resend o en el de disco. Los
dos drivers existentes no cambian — la regla vive en un solo sitio y se prueba
sola.

**La lista se compara en minúsculas y sin espacios**, porque así es como el
resto del módulo normaliza direcciones antes de reservar.

**Las guardas van dentro de `assertEmailConfigured`**, que ya es la
comprobación de "Envío de correo" en la lista de arranque: así aparecen en el
mismo informe que las demás y no en un mensaje aparte.

**El candado del marketing cambia solo su texto.** El mecanismo (variable
explícita, cerrado por omisión, tres capas) sigue siendo correcto; lo que estaba
desactualizado era el motivo.
