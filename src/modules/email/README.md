# Correo

Cómo sale un correo de KORA. Requisitos: `openspec/changes/email-marketing/specs/email-delivery/`.

## Dos drivers, una interfaz

Misma forma que el almacenamiento de imágenes, y por el mismo motivo: sin un
driver de desarrollo no habría manera de trabajar el módulo —ni de probarlo—
sin cuenta de proveedor y dominio verificado, que hoy no existen.

| | Cuándo | Qué hace |
|---|---|---|
| `file-driver` | Desarrollo | Escribe un `.eml` real en `.emails/`. Se **abre y se lee** |
| `resend-driver` | Producción | Entrega por el proveedor |

Se escribe el correo a disco y no un registro de que salió, a propósito: un
correo roto —un enlace mal armado, un pie que se perdió, un precio que no
debería estar— se ve; deducirlo de un log, no.

## Sin proveedor, en producción la aplicación NO arranca

`config.ts` + `instrumentation.ts`. Es la lección que ya costó una vez con las
imágenes: una comprobación perezosa deja el contenedor reportándose sano con el
módulo roto, y el fallo aparece cuando alguien lanza la primera campaña — es
decir, delante del cliente.

En desarrollo no aplica: el driver de disco funciona sin configurar nada.

## La plantilla

`template.ts` es **un solo generador** para la vista previa y el envío. Dos se
desincronizan, y aquí el error se descubre después de mandárselo a diez mil
personas.

El HTML es deliberadamente anticuado —tablas, anchos fijos, estilos en línea—
porque un cliente de correo no es un navegador: Outlook usa el motor de Word y
Gmail descarta la hoja de estilos. Siempre se genera además **texto plano**: su
ausencia es una de las señales que los filtros de spam usan para clasificar, y
este dominio todavía no tiene reputación que lo compense.

**El pie legal no es opcional**: nombre del negocio, política de tratamiento de
datos y enlace de baja. Ley 1581 en Colombia y CAN-SPAM en Estados Unidos, y
KORA vende en los dos.

**Los precios salen de `resolvePrice()`**, también dentro de un correo. Audiencia
de un país → precio en su moneda; audiencia mixta → **sin precio**, con enlace a
la ficha. No existe tasa de cambio en KORA.

## ⚠️ Lo que NO está verificado

- **El driver del proveedor no se ha probado contra la cuenta real.** Está escrito
  contra la API documentada. Activarlo incluye probar un envío de verdad.
- **La plantilla no se ha visto en clientes de correo reales.** No hay forma sin
  enviar. El HTML conservador es la apuesta; la comprobación es parte de activar
  el proveedor.

## Variables

`RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_STORE_URL`. Además del proveedor, el
dominio necesita **SPF, DKIM y DMARC** publicados — pendiente del cliente.
