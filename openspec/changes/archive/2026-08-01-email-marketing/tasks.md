## 1. Esquema

- [x] 1.1 Ampliar `Campaign`: bloques de contenido (asunto, preheader, título, texto, imagen, botón), productos destacados, país de la audiencia, copia inmutable del HTML enviado, contadores (enviados, fallidos, bajas generadas) y progreso.
- [x] 1.2 Ampliar `CampaignRecipient`: estado con "en envío", número de intentos, motivo de fallo, momento de reserva. Índice para tomar pendientes de una campaña.
- [x] 1.3 Añadir al cliente el estado de suscripción con su registro auditable: si está suscrito, si el correo es utilizable, y una tabla de cambios con fecha y origen.
- [x] 1.4 Migración versionada y aplicada; `pnpm db:seed` sigue corriendo.

## 2. Transporte de correo

- [x] 2.1 `src/modules/email/driver.ts`: la interfaz — un correo, un destinatario, HTML y texto plano; devuelve identificador o error.
- [x] 2.2 `file-driver.ts`: escribe el correo a disco en formato legible (`.eml`), para poder **abrirlo** en desarrollo en vez de deducir que salió.
- [x] 2.3 `resend-driver.ts`: el proveedor, con su encabezado de baja nativo. **⚠️ NO probado contra la cuenta real** —no existe— : está escrito contra la API documentada y verificado solo en su forma. Probar un envío real es parte de activar el proveedor.
- [x] 2.4 `config.ts` + guarda de arranque en `src/instrumentation.ts`: en producción sin proveedor configurado, la aplicación **no arranca** y dice qué variable falta. En desarrollo, driver de disco sin configurar nada.
- [x] 2.5 Pruebas: el driver de disco deja un archivo legible; la guarda falla en producción y no en desarrollo; un fallo del proveedor se reporta sin marcar enviado.

## 3. Plantilla de marca

- [x] 3.1 `template.ts`: un solo generador que produce HTML y texto plano, con la paleta y la tipografía del manual. HTML conservador (tablas, estilos en línea) porque un cliente de correo no es un navegador.
- [x] 3.2 Pie legal obligatorio: nombre del negocio, enlace a la política de datos y enlace de baja.
- [x] 3.3 Productos destacados con `resolvePrice()`; audiencia de un país → precio en su moneda; audiencia mixta → **sin precio**, con enlace a la ficha.
- [x] 3.4 Pruebas: el pie siempre lleva los tres elementos; la audiencia mixta nunca muestra un precio; el texto plano contiene lo esencial del HTML.

## 4. Consentimiento y baja

- [x] 4.1 `consent/token.ts`: enlace firmado por cliente, sin almacenamiento y sin caducidad, con su verificación.
- [x] 4.2 `consent/subscription.ts`: suscribir, dar de baja y re-suscribir, **siempre** dejando registro con fecha y origen.
- [x] 4.3 `consent/suppression.ts`: rebote duro marca el correo como no utilizable; queja de spam da de baja. Idempotentes.
- [x] 4.4 Página pública `/suscripcion/baja`: un clic da de baja y confirma, sin sesión; ofrece re-suscribirse.
- [x] 4.5 Registrar el consentimiento del checkout con su origen, sin cambiar la estructura del checkbox (decisión pendiente de Daniel). **De paso se corrigió un fallo real:** `resolveOrderCustomer` hacía `found.acceptsMarketing || input`, así que volver a comprar RE-SUSCRIBÍA a quien se había dado de baja.
- [x] 4.6 El perfil del cliente en el panel muestra el estado de suscripción **en solo lectura**, explicando que solo el cliente puede reactivarlo.
- [x] 4.7 Pruebas: un enlace manipulado no surte efecto; volver a comprar no re-suscribe; el panel no puede re-suscribir; rebote y queja son idempotentes; el historial conserva baja y vuelta.

## 5. Audiencia

- [x] 5.1 `campaigns/audience.ts`: filtros combinables por país, actividad (pedidos confirmados), cuenta y categoría comprada, en intersección.
- [x] 5.2 Exclusión de bajas y correos no utilizables al construir la audiencia, y conteo con agregación (no trayendo filas).
- [x] 5.3 Congelar la lista al iniciar el envío, guardando el correo tal como estaba.
- [x] 5.4 Pruebas: los filtros intersectan; un desuscrito nunca entra; un segmento vacío se dice y no deja enviar; la lista congelada guarda el correo del momento.

## 6. Envío por lotes

- [x] 6.1 `campaigns/status.ts`: transiciones permitidas, sin retroceso; enviada no se edita ni se elimina.
- [x] 6.2 Paso a Enviando **idempotente**, garantizado por la base: dos disparos simultáneos producen un solo envío.
- [x] 6.3 `campaigns/dispatch.ts`: toma un lote de pendientes con bloqueo que salta lo ocupado, **reserva antes de enviar**, envía, marca resultado. Revalida supresión por lote — segunda barrera.
- [x] 6.4 Registrar el trabajo `campaigns:dispatch` y el disparo de campañas programadas en `src/modules/jobs/definitions.ts`.
- [x] 6.5 Barrido de destinatarios que quedaron reservados por un proceso muerto.
- [x] 6.6 Congelar el HTML enviado y actualizar los contadores.
- [x] 6.7 Pruebas: **reanudar tras una caída no reenvía a nadie**; dos despachadores a la vez no duplican; un destinatario fallido no bloquea el lote; quien se dio de baja a mitad no recibe.
- [x] 6.8 Prueba de la campaña programada: al llegar su hora, la audiencia se recalcula con los filtros guardados.

## 7. El panel

- [x] 7.1 `/admin/campanas`: listado con estados, audiencia, destinatarios, fecha y métricas; filtro por estado; card de suscritos actuales.
- [x] 7.2 Crear y editar campaña: contenido, productos destacados, vista previa (ruta `/previa`, mismo render del envío) y correo de prueba. **La carga de imagen del banner quedó fuera**: el campo existe en el modelo y la plantilla lo pinta, pero el panel todavía no sube el archivo a R2 — se reutiliza la subida del catálogo en un ajuste corto.
- [x] 7.3 Audiencia con conteo antes de enviar, y confirmación que repite el número.
- [x] 7.4 Programar, cancelar (solo programada) y duplicar (crea borrador).
- [x] 7.5 Detalle de campaña enviada, de solo lectura, con el contenido tal como salió y las métricas que **sí** se tienen; las del proveedor dicen que no están disponibles y por qué.
- [x] 7.6 Todas las acciones con `requirePermission`: `marketing:view`, `marketing:create`, `marketing:send`.
- [x] 7.7 Prueba de RBAC: quien no tiene `marketing:send` no puede disparar un envío.

## 8. Documentación y cierre

- [x] 8.1 `src/modules/email/README.md` y `src/modules/campaigns/README.md`.
- [x] 8.2 Actualizar `CLAUDE.md` de la app, `openspec/config.yaml` si cambia alguna regla, y la bitácora de sprints.
- [x] 8.3 Anotar en `../notas-tecnicas-privado.md`: el desvío respecto de BullMQ, la disyuntiva de reservar antes de enviar, que la plantilla no está verificada en clientes de correo reales, y la decisión pendiente del checkbox.
- [x] 8.4 Dejar escrito para el cliente, en la bitácora, **exactamente** qué debe decidir: correo corporativo sí/no y dirección remitente.
- [x] 8.5 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.
