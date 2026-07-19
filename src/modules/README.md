# Módulos de dominio

La lógica de negocio vive aquí, organizada por dominio — no por tipo de archivo.
Las rutas de `src/app/` son delgadas: validan entrada y llaman a estos módulos.

| Módulo | Responsabilidad | Semana |
|---|---|---|
| `auth` | Login, sesión (Redis), RBAC módulo×acción | S2 |
| `catalog` | Productos, categorías, variantes, SKU, importador Excel | S3 |
| `inventory` | **La función transaccional de stock** (único camino que modifica `stockActual`), libro contable, job de verificación | S4 |
| `orders` | Pedidos, estados, `order.confirmed` + outbox, mensaje WhatsApp | S8 |
| `pos` | Punto de venta (usa `inventory`, el mismo motor que la web) | S9 |
| `crm` | Clientes, historial, seguimiento | S10 |
| `loyalty` | KoraPuntos (ledger, mismo patrón que stock) | S12 |
| `marketing` | Campañas, segmentación, envío vía cola | S13 |
