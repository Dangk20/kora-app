## 1. Modelo
- [x] 1.1 Tabla `ruleta_giros` (únicos por cuenta y celular) y `benefits.extraCategoryIds`; migración `ruleta`

## 2. Dominio
- [x] 2.1 Premios en código; peso, tope y apertura en `settings`
- [x] 2.2 `girar` con candado consultivo, topes, inventario y beneficio en la misma transacción
- [x] 2.3 Descuento por varias categorías (y dos niveles de ancestros) en caja

## 3. Interfaz
- [x] 3.1 `/ruleta`: ruleta con colores de KORA, registro, giro, foco en la tajada ganadora y celebración
- [x] 3.3 Registro sin contraseña: clave temporal por correo y cambio obligado al primer acceso
- [x] 3.4 Datos válidos: celular de 10 dígitos que empieza por 3 (+57 fijo), correo con forma real, sugerencia de dominio mal escrito y dominio que recibe correo (MX), en el formulario y en el servidor
- [x] 3.2 `/admin/ruleta`: abrir/cerrar, pesos y topes, QR y cartel

## 4. Verificación
- [x] 4.1 `tests/ruleta.test.ts` (giro único, celular repetido, varias categorías, tope con giros simultáneos)
- [ ] 4.2 Prueba en pruebas con los productos reales y aprobación de KORA de premios y probabilidades
