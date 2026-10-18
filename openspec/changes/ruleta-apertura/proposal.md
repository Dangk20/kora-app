## Why

**Gran apertura de la tienda de Neiva (7 nov 2026).** La métrica de la apertura es cuentas KORA creadas ese día. KORA aprobó hacer la ruleta digital y propia: el cliente escanea un QR en la tienda, crea su cuenta y gira una vez; todos ganan y el premio queda como beneficio de 30 días.

## What Changes

- **`/ruleta`** (tienda, es/en): ventana al estilo de la ruleta de Temu con los colores de KORA. Primero se ve la ruleta; al tocar "Girar" se pide la cuenta **sin contraseña** (nombre, celular obligatorio, correo, aceptación de datos y promociones opcionales) y se gira de una. Al frenar, la tajada ganadora se ilumina bajo la flecha, sale la celebración (estrellas, confeti, cupón del premio) y un bloque claro de dónde, cómo y hasta cuándo usarlo. Quien ya giró ve su premio sin la ruleta (sin scroll).
- **Contraseña temporal por persona**: el registro rápido crea la cuenta con una clave aleatoria propia (`KORA-XXXXXX`) que llega por correo; `customers.mustChangePassword` obliga a cambiarla en el primer acceso (`/cuenta/nueva-clave`). No se usa una clave estándar compartida: dejaría entrar a cualquier cuenta sabiendo solo el correo.
- **Un giro por cuenta y por celular**: tabla `ruleta_giros` con índices únicos en `customerId` y `phone`.
- **El premio lo decide el servidor** dentro de una transacción serializada con candado consultivo, respetando peso y tope de cada premio; un producto de regalo sin inventario no sale.
- **Premios** (`modules/ruleta/premios.ts`): $5.000 y $10.000 de Kora Cashback, 10 % en maquillaje y belleza, 15 % en ropa (Mujer, Hombre, Niña, Niño, Bebé niña y Bebé niño), bálsamo labial KFMB-0082 y strapless KMR-0044 de regalo. Peso, tope y si la ruleta está abierta viven en `settings` (`ruleta`); cerrada por omisión en producción.
- **Beneficio con varias categorías**: `benefits.extraCategoryIds`; el descuento cubre la categoría del producto y dos niveles de ancestros.
- **Panel `/admin/ruleta`** (`loyalty:view`; editar `loyalty:adjust`): abrir/cerrar, peso y tope por premio con su probabilidad, avisos de inventario y categorías faltantes, giros y usados, QR del dominio actual y cartel para imprimir.

## Capabilities

### New Capabilities
- `ruleta-apertura`: registro desde la ruleta, giro único, premios configurables y panel.

## Impact

Migración `ruleta`. Nuevos `src/modules/ruleta/`, `src/app/(tienda)/ruleta/`, `src/app/admin/ruleta/`, mensajes `ruleta` es/en. Cambios en `benefits.ts` y `pos/sale.ts` (varias categorías). Dependencia `qrcode`. Pruebas: `tests/ruleta.test.ts`.
