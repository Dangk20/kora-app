## 1. Consumo

- [x] 1.1 Modelo `ProviderSend` y migración
- [x] 1.2 `createAccountingDriver` en `email/index.ts`, en la cadena correcta
- [x] 1.3 `email/usage.ts`: consumo de hoy y del mes (UTC) y límites configurables
- [x] 1.4 Barra de consumo en `/admin/campanas`
- [x] 1.5 Comprobación de cupo en `startCampaign` / `sendNow`: bloquea por mes, avisa por día con confirmación

## 2. Eventos del proveedor

- [x] 2.1 Modelo `EmailEvent` y migración (único por `svixId`)
- [x] 2.2 `email/webhook.ts`: verificación de firma y ventana de tiempo
- [x] 2.3 Ruta `POST /api/webhooks/resend`: guarda, aplica supresión, responde 200 a duplicados
- [x] 2.4 Métricas de campaña desde eventos; "no disponibles" solo sin secreto
- [x] 2.5 Caddyfile: `/api/webhooks/*` sin contraseña en pruebas; aplicar en el servidor

## 3. Cierre

- [x] 3.1 Pruebas: contable (proveedor sí, disco no), consumo UTC, cupo mes/día, firma válida/inválida/vieja, duplicado, rebote → supresión
- [x] 3.2 `.env.example` con las tres variables
- [ ] 3.3 Configurar el secreto en `.env.staging` (Daniel crea el webhook en Resend y activa el rastreo del dominio)
