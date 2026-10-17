## 1. Modelo
- [x] 1.1 Enums y tabla `benefits`; migración `beneficios`
- [x] 1.2 `creditCashback` acepta `expiresAt`

## 2. Dominio
- [x] 2.1 `otorgarBeneficio`, `beneficiosDe`, `beneficiosParaCaja`, `tomarBeneficio` (FOR UPDATE)
- [x] 2.2 Venta POS: `benefitId`, descuento por categoría (con subcategorías) y producto de regalo
- [x] 2.3 Venta POS: 3 % de Kora Cashback con cliente
- [x] 2.4 Acciones: `otorgarBeneficioAdmin` (`loyalty:adjust`), `beneficiosCaja`, `descuentoBeneficioCaja` (`pos:sell`)

## 3. Interfaz
- [x] 3.1 Ficha del cliente: sección Beneficios + Otorgar beneficio
- [x] 3.2 Cuenta del comprador: Mis beneficios (es/en)
- [x] 3.3 Cobro en caja: beneficios del cliente, total con descuento, cashback ganado

## 4. Pruebas
- [x] 4.1 `tests/beneficios.test.ts` (otorgar, estados, canje, doble canje, cashback)
- [ ] 4.2 Prueba manual en el navegador
