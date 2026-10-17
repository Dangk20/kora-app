## Why

**Semana del plan: S9 (POS). Alcance: cotización §3 "Punto de venta"** (catálogo para venta presencial, escáner, cobro manual sin pasarela, impresión del comprobante) **+ §4 inventario unificado.** No hay HU escrita: los módulos base se especifican por el plan técnico y el prototipo aprobado (`hus-consolidadas-kora-v2.md` §Alcance). La tienda física de Neiva vende desde finales de octubre (gran apertura el 7 nov) y hoy no tiene caja: cada venta presencial quedaría fuera del inventario que comparte con la web.

## What Changes

- **Pantalla de caja `/pos`** (permiso `pos:view`), con el layout del prototipo: buscador/escáner (Enter agrega por código de barras o SKU exacto), filtro por categoría, grilla de productos con SKU, precio de tienda y stock, y a la derecha el ticket en curso con cantidades, total y "Cobrar".
- **Cobrar** (permiso `pos:sell`): método de pago (efectivo con vueltas, datáfono, transferencia (Nequi incluido)) y datos opcionales del cliente. En **una transacción**: crea el pedido `channel = POS`, descuenta el stock con el **mismo motor** que la web (`VENTA_POS`, sin tope por cupo online), lo deja **entregado** y congela el comprobante.
- **Precio: siempre el de tienda en COP** (`resolvePrice(…, "COP", "store")`).
- **Recibo imprimible de 80 mm** (`/pos/recibo/[id]`) con la estructura de un documento de venta colombiano: razón social, NIT, domicilio, consecutivo, fecha y hora, código + descripción + cantidad + valor, total, medio de pago y vueltas. Dice **"Precios con IVA incluido"** y **"Este recibo no es factura electrónica"**.
- **Prueba de aceptación de S9:** concurrencia cruzada web + POS sobre la última unidad → exactamente una gana.

## Capabilities

### New Capabilities
- `pos-sale`: cómo la caja arma un ticket, cobra, descuenta el inventario unificado y emite el recibo.

## Impact

- **Datos:** sin migración. `Order` ya tiene `channel = POS`, `StockReason.VENTA_POS` y `Variant.barcode`.
- **Código:** `src/modules/pos/` (catálogo, venta, recibo), `src/app/pos/` (caja y recibo), `admin/nav-links.tsx` (quita el "S9"), `tests/pos.test.ts`, `tests/comprobante.test.ts` (el POS entra en la regla "quien confirma congela el comprobante").
- **Eventos:** una venta POS **no** escribe `order.confirmed`. Ese evento dispara correo al comprador, cashback y la compra a Meta/GA4: una venta de mostrador inflaría la medición publicitaria y no tiene a quién escribirle.

## Fuera de alcance

- **Facturación electrónica / Documento Equivalente Electrónico POS (DIAN).** Desde nov 2024 el tiquete de papel no es documento fiscal: KORA debe emitirlo con un proveedor tecnológico. Integrarlo es alcance nuevo (ver `../../business/iva-y-facturacion-colombia.md`).
- Discriminar IVA en el recibo (depende del RUT y el contador de KORA).
- Cierre o arqueo de caja, apertura con base, varias cajas, devoluciones y cambios en caja.
- Cupones, Kora Cashback y beneficios de la ruleta en caja.
- Impresión directa a impresora térmica (se usa la impresión del navegador).

## Bloqueos

Ninguno para construir. Para producción: modelo de la impresora de la tienda (se asume 80 mm) y decisión de KORA sobre facturación electrónica.
