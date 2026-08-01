# Cuenta del comprador

El comprador de la tienda: quién es, cómo lo demuestra y qué ve dentro.
Requisitos: `openspec/changes/cuenta-comprador/specs/`.

## Por qué esto NO es Auth.js

Los operadores se autentican con Auth.js contra `users`. El comprador **no**, y
la separación es el punto entero del módulo.

El middleware protege `/admin` y `/pos` con `Boolean(auth?.user)`: **cualquier**
sesión de Auth.js pasa. Si el comprador entrara por ahí, la protección del panel
pasaría a depender de que toda ruta y toda acción futura se acuerde de mirar una
marca en el token — y una que se olvide es un comprador confirmando pedidos y
moviendo inventario.

Con cookie propia (`kora_buyer`) y camino de verificación propio, para el panel
un comprador es exactamente igual que alguien sin sesión. La ruta nueva bajo
`/admin` queda protegida **por omisión**, no por acordarse.

**Opaca y en la base** porque un JWT no se puede retirar: cerrar sesión solo
borraría la cookie del navegador que está delante. Detrás de esta cuenta hay
saldo gastable. Es la misma decisión que rige `requirePermission()`.

## Los archivos

| Archivo | Qué hace |
|---|---|
| `password.ts` | Cifrado, mínimo exigido y la comparación de descarte |
| `session.ts` | El mecanismo: emitir, resolver, revocar, barrer. **Sin `next/headers`** |
| `session-cookie.ts` | El transporte: la cookie. Separado porque el worker corre fuera de Next |
| `account.ts` | Registro, acceso y cambio de contraseña |
| `rate-limit.ts` | Límite de intentos, en memoria del proceso |
| `guard.ts` | `requireBuyer()` para las pantallas de la cuenta |
| `orders.ts` | Los pedidos del comprador, siempre acotados a él |

## Reglas que no se negocian

**Nada revela si un correo tiene cuenta.** Correo inexistente, contraseña
incorrecta y cuenta desactivada dan el mismo mensaje, y el registro responde
igual exista o no la cuenta. Distinguirlos convierte el formulario en un
comprobador de clientela: se van probando correos y sale la lista de compradores
de KORA. Cuando no hay contraseña que comparar se quema el tiempo de una
comparación real, o la latencia delata lo que los mensajes ocultan.

**El comprador solo ve lo suyo.** El identificador del comprador va **en el
`where`**, no en una comprobación posterior. Un pedido ajeno no existe para la
consulta. La pregunta no es "¿existe este pedido?" sino "¿es de quien pregunta?".

**La credencial cuelga del cliente**, no de una tabla paralela. Por eso
registrarse con un correo que ya compró como invitado es ponerle contraseña a un
cliente que ya existe, y su historial y su cashback aparecen solos.

**Con sesión, el pedido se ata por identidad** (`orders/customer-link.ts`). La
coincidencia por correo o teléfono queda para el invitado, que es donde es el
único dato que hay. Y el correo de la cuenta **no se reescribe desde el
checkout**: es la credencial de acceso.

**La cuenta solo lee el libro de cashback.** Ninguna pantalla de la tienda
escribe un movimiento.

## Lo que todavía no está

- **Recuperación de contraseña.** Bloqueada: `korashopp.com` no tiene registros
  de correo (SPF/DKIM/DMARC), así que el enlace no llegaría. Un flujo que no
  entrega es peor que no ofrecerlo. Mientras tanto, la pantalla dirige a
  WhatsApp.
- **Canje del cashback en el checkout.** Change aparte; este lo desbloquea.
- **Borrado de cuenta** (Habeas Data) y **ofrecer cuenta al invitado tras
  comprar.** Preguntas abiertas anotadas en las notas técnicas privadas.

⚠️ **El límite de intentos vive en memoria del proceso.** Con una instancia es
correcto. Si algún día corre más de una, deja de ser global y hay que moverlo.
