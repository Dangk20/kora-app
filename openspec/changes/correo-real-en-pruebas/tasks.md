## 1. Lista de destinatarios

- [x] 1.1 `allowlist(env)` en `config.ts`: lee `KORA_EMAIL_ALLOWLIST`, normaliza, devuelve conjunto
- [x] 1.2 Guardas en `assertEmailConfigured`: sin lista fuera de producción con proveedor; con lista en producción
- [x] 1.3 Driver compuesto en `index.ts`

## 2. Candado del marketing

- [x] 2.1 Reescribir `MARKETING_LOCK_REASON` con lo que falta hoy

## 3. Pruebas y cierre

- [x] 3.1 Pruebas: permitido → proveedor, no permitido → disco, mayúsculas, y las dos guardas
- [x] 3.2 `.env.example` documenta la variable
- [ ] 3.3 Configurar `.env.staging` en el servidor con la clave y la lista (a mano)
- [ ] 3.4 Verificar en pruebas: un correo de prueba de campaña llega a la bandeja destino
