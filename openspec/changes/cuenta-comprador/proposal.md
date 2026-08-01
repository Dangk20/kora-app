# Cuenta del comprador

**Semana del plan:** ninguna. El plan nunca le dio semana propia, y es la razón por la que hoy bloquea a dos módulos ya construidos.

**HUs:** **no existen.** No hay `hus-acceso.md` ni historia del área ACC para la tienda: las HUs escritas del área de acceso son del panel (operadores y roles), no del comprador. La fuente de requisitos aquí es el **alcance firmado** y las **reglas del cliente**, y se dice en vez de trazar contra una historia inventada:

- `business/alcance-detallado-desarrollo-kora.md` §7: *"El cliente ve sus KoraPuntos en el apartado **Perfil de su cuenta al iniciar sesión**"*.
- `business/kora-cashback-reglas-cliente.md` §7: el comprador debe poder consultar **en su cuenta** su saldo disponible, su cashback pendiente, la fecha de vencimiento y el historial de ganado y utilizado.

Queda pendiente escribirlas como HUs y llevarlas al tablero.

## Why

**Kora Cashback está construido y el comprador no puede verlo.** La acumulación funciona —se acredita al confirmar, con su libro y su vencimiento— pero la mitad de la funcionalidad que el cliente pidió vive "en su cuenta", y esa cuenta no existe: el menú de la tienda dice **"Mi cuenta · Próximamente"**.

**Y el canje no se puede construir sin ella.** Hoy el comprador se identifica escribiendo su correo y su teléfono en el formulario del checkout; el pedido reconoce o crea al cliente en silencio a partir de ahí. Si sobre eso se permitiera pagar con saldo, **cualquiera que sepa el correo de otra persona podría gastarle el cashback**. No es un riesgo teórico: el correo de un comprador es el dato más fácil de conseguir que existe. La identidad tiene que ser algo que el comprador demuestre, no algo que escriba.

Es, en una frase: **el cashback ya es dinero, así que ya hace falta una puerta con llave.**

**Además arregla algo que ya está torcido.** El pedido ata al cliente por coincidencia de correo o teléfono. Dos personas de la misma casa que compran con el mismo correo son hoy el mismo cliente, y un dedazo en el teléfono crea un cliente nuevo. Con sesión, el pedido se ata a **quien está dentro**, y la coincidencia queda solo para el comprador invitado.

## What Changes

- **Registro y acceso del comprador** con correo y contraseña, separado por completo del acceso de los operadores.
- **Sesión propia, verificada contra la base y revocable**: no un JWT que viva por su cuenta hasta que caduque.
- **"Mi cuenta"**: perfil, **Kora Cashback** (disponible por moneda, pendiente, próximo vencimiento e historial) e **historial de pedidos** con su estado.
- **El checkout reconoce la sesión**: quien ha entrado no vuelve a escribir sus datos y su pedido se ata a su cliente por identidad, no por coincidencia.
- **La compra como invitado sigue existiendo.** Obligar a registrarse para comprar es la forma más rápida de perder una venta, y el negocio no la ha pedido.

## Capabilities

### New Capabilities

- `buyer-authentication`: quién es el comprador y cómo lo demuestra — registro, acceso, sesión y su revocación, y por qué un comprador nunca puede alcanzar el panel.
- `buyer-account`: qué ve el comprador dentro — su cashback con el detalle que pidió el cliente, sus pedidos y sus datos.

### Modified Capabilities

Ninguna capacidad publicada cambia: `openspec/specs/` sigue vacío porque los changes anteriores no se han archivado.

## Fuera de alcance

- **El canje del cashback en el checkout.** Es el change siguiente y este lo desbloquea. Se separa a propósito: aquí se decide **quién es** el comprador; allí, **qué puede gastar** — y eso toca `createOrder()`, el camino crítico de la venta, con la exclusión mutua con cupones que el cliente definió.
- **Acceso con Google o Facebook.** No lo pidió el negocio y añade un proveedor externo al camino de la venta.
- **Recuperación de contraseña.** Ver bloqueos.
- **Direcciones guardadas y lista de deseos.** No están en el alcance firmado.

## Bloqueos declarados

**La recuperación de contraseña no se puede construir todavía**, y hay que decirlo claro porque una tienda sin ella genera soporte desde el primer día: `korashopp.com` **no tiene registros de correo** (SPF, DKIM, DMARC). Sin ellos, el enlace de recuperación llegaría a spam o no llegaría, que en un correo de seguridad es peor que no ofrecerlo.

Es el mismo bloqueo ya declarado para el módulo de correo (S13) y está pendiente del cliente desde el 31 jul. **Consecuencia mientras dure:** quien olvide su contraseña tiene que escribir por WhatsApp. Se asume a propósito y no se disimula con un formulario que no funciona.

## Impact

**Archivos nuevos**
- `src/modules/buyer/` — registro, acceso, sesión y el guard de la tienda
- `src/app/(tienda)/cuenta/` — entrar, crear cuenta y el panel del comprador
- `tests/buyer-auth.test.ts`

**Archivos modificados**
- `prisma/schema.prisma` + migración — credenciales del comprador y sus sesiones
- `src/app/(tienda)/layout.tsx` — "Mi cuenta · Próximamente" pasa a ser un enlace real
- `src/modules/orders/checkout-actions.ts` — el pedido de quien tiene sesión se ata a su cliente
- `src/middleware.ts` — la sesión del comprador nunca alcanza `/admin` ni `/pos`

**Reglas del proyecto que este change NO puede violar**
- **Un comprador jamás puede alcanzar el panel ni el POS.** La sesión del comprador y la del operador son cosas distintas y no deben poder confundirse ni por descuido.
- **La sesión se verifica contra la BASE, no contra el token** — es la misma decisión que ya rige `requirePermission()`: cerrar una sesión debe surtir efecto ya, no cuando caduque.
- **El saldo se lee, nunca se toca.** Ninguna pantalla de la tienda escribe en el libro de cashback.

**Riesgo principal**
Una sesión de comprador que sirva para entrar al panel sería el fallo más grave que puede tener este proyecto: el panel confirma pedidos y mueve inventario. Se fija con prueba, no con cuidado.
