## Why

**Apertura de la tienda física de Neiva (7 nov 2026).** KORA quiere premiar a sus clientes con una ruleta en la apertura y poder regalar beneficios a mano. Hoy no existe dónde guardar un premio, ni cómo canjearlo en caja, ni cómo lo ve el comprador. Además, la caja no acumulaba Kora Cashback aunque la regla del cliente dice que el 3 % aplica también en el POS cuando la compra está asociada a un cliente.

## What Changes

- Nuevo modelo **Benefit** con tres tipos: **cashback de regalo**, **descuento por categoría** (%, cubre las subcategorías) y **producto de regalo**. Origen **Ruleta** o **Manual**. Vigencia de **30 días** y un solo uso.
- El cashback de regalo se acredita al otorgarse como **lote propio** que vence con el beneficio (`creditCashback` acepta `expiresAt`).
- **Ficha del cliente (panel):** sección "Beneficios" con estado vigente / usado / vencido y botón **"Otorgar beneficio"** (solo administrador, `loyalty:adjust`).
- **Cuenta del comprador:** "Mis beneficios" bajo Kora Cashback, en español e inglés.
- **Caja:** al encontrar al cliente por celular se listan sus beneficios canjeables; al elegir uno, el servidor calcula el descuento y el total se actualiza. El canje ocurre en la misma transacción de la venta, con bloqueo de la fila del beneficio.
- **Caja acumula Kora Cashback:** 3 % de lo pagado con dinero cuando la venta se ata a un cliente, dentro de la transacción de la venta.

## Capabilities

### New Capabilities
- `customer-benefits`: otorgar, listar y canjear beneficios; cashback en caja.

## Impact

Migración `beneficios` (enums `BenefitKind`, `BenefitSource`; tabla `benefits`). Nuevo `src/modules/benefits/` (`benefits.ts`, `actions.ts`). `pos/sale.ts` (armado de líneas extraído, `benefitId`, descuento, cashback), `pos-view.tsx`, `admin/clientes/{page,customer-sheet,beneficios}.tsx`, `(tienda)/cuenta/{page,beneficios-panel}.tsx`, i18n de la cuenta. Pruebas: `tests/beneficios.test.ts`; limpieza de `tests/pos.test.ts`.

## Fuera de alcance

La ruleta y el registro rápido por QR (siguiente change: dependen de los productos y cantidades que defina KORA). Canje de beneficios en la tienda online.
