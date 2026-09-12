## Why

Para la reunión de aprobación hay que enseñar el módulo de Email marketing
**entregando un correo de verdad** en una bandeja que el cliente pueda abrir.
Pero pruebas escribe los correos a disco a propósito: su base tiene direcciones
reales, y darle la clave del proveedor haría que una campaña de demostración le
llegara a una persona de verdad.

Hoy no hay término medio: o todo el entorno envía, o nada.

## What Changes

- **Lista de destinatarios permitidos** (`KORA_EMAIL_ALLOWLIST`, separada por
  comas) para entornos que **no** son producción. Con el proveedor configurado y
  la lista puesta, los correos a esas direcciones salen por el proveedor; **a
  cualquier otra dirección, van a disco** como hasta ahora.
- **Guardas de arranque**, en la misma línea que el resto del proyecto:
  - Fuera de producción, proveedor configurado **sin** lista = no arranca. Es
    justo la fuga que se quiere impedir, y una configuración incompleta nunca se
    resuelve sola hacia el lado peligroso.
  - En producción, lista puesta = no arranca. Una lista olvidada ahí dejaría a
    los compradores sin sus correos **sin ningún error**.
- **El candado de Email marketing dice lo que falta HOY.** Su texto sigue
  citando el proveedor y los registros DNS, resueltos el 28 ago. Pasa a decir lo
  real: la decisión de abrirlo, el plan del proveedor y que las respuestas
  rebotan.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `email-delivery`: el driver del proveedor pasa a respetar una lista de
  destinatarios fuera de producción, y el arranque comprueba que la lista y el
  entorno sean coherentes.

## Impact

- `src/modules/email/config.ts`, `index.ts` — lista, guardas y driver compuesto.
- `src/modules/campaigns/lock.ts` — texto del candado.
- `.env.example`, `.env.staging` en el servidor (a mano: la clave nunca viaja en
  el repositorio).
