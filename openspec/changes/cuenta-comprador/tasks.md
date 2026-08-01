## 1. Esquema

- [x] 1.1 Añadir al cliente las credenciales de la tienda: contraseña cifrada (opcional — quien compró como invitado no tiene), fecha de alta de la cuenta y estado. El correo ya existe y ya es único.
- [x] 1.2 Crear la tabla de sesiones del comprador: hash del identificador (único), cliente, vencimiento, última actividad y datos del origen para el diagnóstico. Índices por cliente y por vencimiento.
- [x] 1.3 Migración versionada y aplicada; `pnpm db:seed` sigue corriendo.

## 2. Contraseña y sesión

- [x] 2.1 `src/modules/buyer/password.ts`: cifrado irreversible con la misma librería que ya usa el panel, y la política mínima con su mensaje.
- [x] 2.2 `src/modules/buyer/session.ts`: crear sesión (identificador aleatorio en la cookie, su hash en la base), leerla verificando **contra la base**, revocar una y revocar todas las de un cliente. Cookie propia `kora_buyer`, `httpOnly` y `secure` en producción. **`sameSite` quedó en `lax`, no estricto**: la vuelta desde WhatsApp es una navegación entre sitios y con `strict` el comprador volvería sin sesión. El transporte se separó en `session-cookie.ts` — el mecanismo no puede importar `next/headers` porque el worker corre fuera de Next.
- [x] 2.3 Barrido de sesiones caducadas como trabajo programado, junto a los que ya existen.

## 3. Pruebas de sesión (antes de cualquier pantalla)

- [x] 3.1 Una sesión creada autentica; revocarla la invalida **en la petición siguiente**.
- [x] 3.2 Una sesión caducada no autentica; una credencial fabricada tampoco.
- [x] 3.3 En la base no queda el identificador de la cookie, solo su hash.
- [x] 3.4 **La sesión del comprador NO alcanza `/admin` ni `/pos`**: fijado sobre el callback `authorized`, que es lo único que decide quién entra. Una acción protegida del panel queda cubierta por el mismo hecho —`requirePermission()` lee la sesión de Auth.js, que vive en otra cookie— pero eso NO tiene prueba propia: probarlo exigiría fabricar una petición con cookies.
- [x] 3.5 Un operador con sesión del panel no queda identificado como comprador.

## 4. Registro y acceso

- [x] 4.1 `src/modules/buyer/account.ts` (un solo archivo para registro y acceso, no dos): crear la cuenta. Si el correo ya es cliente —compró como invitado—, **le pone contraseña en vez de crear un cliente nuevo**; si ya tenía cuenta, responde igual que un alta normal sin tocar nada.
- [x] 4.2 `account.ts` — acceso con mensajes indistinguibles para correo inexistente, contraseña incorrecta y cuenta desactivada.
- [x] 4.3 Límite de intentos por origen, en memoria, con su anotación de que no sobrevive a una segunda instancia.
- [x] 4.4 Pruebas: el comprador antiguo recupera su historial y su cashback al registrarse; los mensajes no revelan si el correo existe; el límite frena los intentos.

## 5. Pantallas de acceso

- [x] 5.1 `/cuenta/entrar` y `/cuenta/crear`, con los patrones de la tienda y del login del panel (color y tipografía del manual de marca).
- [x] 5.2 La pantalla de acceso **no ofrece recuperación de contraseña** e indica cómo pedir ayuda por WhatsApp, con el motivo anotado en el código.
- [x] 5.3 "Mi cuenta · Próximamente" del menú pasa a ser el enlace real, y muestra el nombre cuando hay sesión.

## 6. El panel del comprador

- [x] 6.1 `src/modules/buyer/guard.ts` — `requireBuyer()`: toda consulta de la cuenta parte de la sesión, nunca de un identificador de la dirección.
- [x] 6.2 `/cuenta`: Kora Cashback con los cuatro datos que pidió el cliente —disponible por moneda, pendiente, próximo vencimiento e historial—, reutilizando `cashbackSummary()`. Sin saldo, se explica cómo se gana.
- [x] 6.3 Historial de pedidos con número, fecha, total, estado y el cashback que generó cada uno.
- [x] 6.4 Detalle del pedido; **un pedido de otro comprador responde como si no existiera**. Un pedido pendiente y vigente ofrece retomar la conversación de WhatsApp; uno expirado, no.
- [x] 6.5 Editar datos y cambiar contraseña; cambiarla **cierra las demás sesiones**.
- [x] 6.6 Pruebas: el pedido ajeno no se filtra, sin sesión se va a la pantalla de acceso, y cambiar la contraseña invalida las otras sesiones.

## 7. El checkout reconoce la sesión

- [x] 7.1 El checkout precarga los datos del comprador con sesión, editables.
- [x] 7.2 `createOrder()` ata el pedido **al cliente de la sesión** cuando la hay; sin sesión sigue la coincidencia por correo o teléfono, sin cambios.
- [x] 7.3 Prueba: con sesión, un teléfono distinto del guardado **no crea un cliente nuevo**; sin sesión, la coincidencia se comporta como hasta ahora.

## 8. Documentación y cierre

- [x] 8.1 `src/modules/buyer/README.md`: por qué la sesión del comprador no es Auth.js y qué garantiza la separación.
- [x] 8.2 Actualizar el `CLAUDE.md` de la app y la bitácora de sprints.
- [x] 8.3 Anotar en `../notas-tecnicas-privado.md`: el bloqueo de la recuperación de contraseña y su coste en soporte, el límite de intentos en memoria, y las dos preguntas abiertas (borrado de cuenta por Habeas Data, ofrecer cuenta al invitado tras comprar).
- [x] 8.4 Declarar el pendiente de escribir las HUs del área de la cuenta del comprador y llevarlas al tablero.
- [x] 8.5 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.
