## Why

**Marketing de la gran apertura (consultoría, campaña S1–S2) — pedido por Daniel el 23 oct 2026. Alcance NUEVO, fuera de la cotización de desarrollo.** La tienda física abre oficialmente el **sábado 7 de noviembre** en la Calle 25 Sur # 32-23, Neiva. Quien entra a korashopp.com durante la campaña de expectativa no tiene cómo enterarse de la fecha: la web no la menciona en ningún lado.

## What Changes

- **Modal de anuncio en la tienda pública**: una ventana con la estética de un calendario (el 7 de noviembre marcado con un círculo a mano, bloque de color de KORA y el titular «Gran apertura»), la dirección y un botón **«Cómo llegar»** que abre Google Maps con la dirección de la tienda.
- **Aparece una sola vez por visitante** (se recuerda en el navegador) y **solo hasta el 7 de noviembre de 2026 inclusive** (hora de Colombia). Después de esa fecha no se muestra a nadie, sin necesidad de desplegar.
- Se cierra con la X, con Escape o tocando fuera; respeta el idioma de la tienda (es/en).
- No aparece en el panel, el POS, el checkout ni las páginas legales.

## Capabilities

### New Capabilities
- `storefront-announcement`: anuncio de evento en la tienda pública (cuándo aparece, cuántas veces y hasta cuándo).

### Modified Capabilities
Ninguna.

## Impact

- **Código**: `src/modules/storefront/announcement/` (componente cliente + configuración de la fecha) y una línea en `src/app/(tienda)/layout.tsx`. Mensajes en `messages/es|en/`.
- **Sin cambios** de datos, permisos ni migraciones.
