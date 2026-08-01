# Diseño — Cuenta del comprador

## Context

Motivación en `proposal.md`. Requisitos en `specs/`.

**Lo que ya existe:**

- **El cliente** (`customers`) ya tiene nombre, correo, teléfono y ahora su saldo de cashback. Le falta exactamente una cosa para ser una cuenta: una credencial.
- **El pedido** ya reconoce o crea al cliente por coincidencia de correo o teléfono, y guarda su propio snapshot del comprador.
- **El módulo de cashback** ya expone todo lo que la cuenta tiene que mostrar en una sola consulta.
- **Auth.js v5** autentica a los operadores contra `users`, con sesión JWT de 12 h y permisos verificados contra la base.

**El problema que define el diseño:** el middleware protege `/admin` y `/pos` con `Boolean(auth?.user)`. Cualquier sesión de Auth.js pasa. Si el comprador entrara por ahí, **entraría al panel**.

## Goals / Non-Goals

**Goals**

- Que un comprador no pueda alcanzar el panel **por construcción**, no por acordarse de comprobarlo.
- Que cerrar sesión sirva de algo.
- Que quien ya compró como invitado recupere su historial al registrarse.

**Non-Goals de diseño**

- **Gastar el cashback.** Change siguiente; este lo desbloquea.
- **Recuperación de contraseña.** Bloqueada por los registros de correo del dominio.
- **Unificar las dos autenticaciones.** Es justo lo contrario de lo que hace falta.

## Decisions

### 1. El comprador NO usa Auth.js: sesión propia, opaca y en la base

**Decisión:** una tabla de sesiones del comprador con un identificador aleatorio guardado cifrado, en una cookie propia (`kora_buyer`), verificado contra la base en cada petición.

**Por qué —y es la decisión que sostiene todo lo demás:** la alternativa natural sería añadir un segundo proveedor a Auth.js con una marca `kind` en el token. Pero entonces las dos identidades comparten cookie y camino de verificación, y la separación depende de que **toda ruta y toda acción futura se acuerde de mirar la marca**. Una que se olvide es un comprador en el panel.

Con cookies y verificación distintas, la ruta nueva del panel es segura **por omisión**: la credencial del comprador ni siquiera se presenta donde Auth.js mira. Se pasa de "no olvidarse" a "no poder".

Opaca y en la base, además, porque un JWT no se puede retirar: cerrar sesión solo borraría la cookie del navegador que la tiene delante. Es la misma razón por la que `requirePermission()` verifica contra la base y no contra el token.

**Coste aceptado:** una consulta por petición autenticada. Es una lectura por clave primaria, y a cambio se puede cerrar una sesión de verdad.

### 2. La credencial cuelga del cliente, no de una tabla paralela

**Decisión:** el correo, la contraseña cifrada y el estado de la cuenta van **en el cliente**. No hay tabla "usuario de la tienda".

**Por qué:** una tabla aparte obligaría a mantener dos correos sincronizados y abriría la puerta a que existan un cliente y una cuenta que son la misma persona sin saberlo — que es justo lo que el registro de un comprador antiguo tiene que evitar. Colgándola del cliente, "registrarse con un correo que ya compró" es **poner contraseña a un cliente que ya existe**, y el historial aparece solo.

**Consecuencia:** un cliente sin contraseña es exactamente lo que hoy son todos — alguien que compró como invitado. No hay migración.

### 3. La sesión guarda el hash del identificador, no el identificador

**Decisión:** la cookie lleva un valor aleatorio; la base guarda su hash.

**Por qué:** quien pueda leer la tabla de sesiones no puede suplantar a nadie con lo que ve. Es el mismo criterio que se aplica a las contraseñas, y por el mismo motivo: una copia de la base no debería ser una copia de las sesiones activas.

### 4. Los mensajes de acceso son deliberadamente iguales

**Decisión:** correo inexistente, contraseña incorrecta y cuenta desactivada devuelven **el mismo mensaje**; el registro con un correo existente responde igual que el registro nuevo.

**Por qué:** distinguirlos convierte el formulario en un comprobador de clientela — se van probando correos y sale la lista de compradores de KORA. Es un dato del negocio, no solo del comprador.

**Coste aceptado:** un comprador que se registró y lo olvidó no recibe un aviso claro. Se compensa con el texto de la pantalla, que dice qué hacer si ya se tiene cuenta.

### 5. Con sesión, el pedido se ata por identidad; sin ella, por coincidencia

**Decisión:** `createOrder()` recibe el cliente de la sesión cuando la hay. La coincidencia por correo o teléfono queda solo para el invitado.

**Por qué:** la coincidencia es lo mejor disponible cuando el único dato es lo que alguien escribió, pero es frágil: un dedazo en el teléfono crea un cliente nuevo y parte en dos el historial y el cashback de quien ya está dentro. Cuando hay sesión, ese dato ya no es el mejor disponible.

### 6. El límite de intentos vive en memoria, no en Redis

**Decisión:** contador por origen dentro del proceso.

**Por qué:** hay **un** proceso de aplicación; Redis está levantado pero todavía no se usa para nada. Añadir la dependencia ahora sería complejidad al servicio de una escala que no existe —justo lo que este proyecto decidió no hacer—. Queda anotado: **si algún día corre más de una instancia, el contador deja de ser global** y hay que moverlo.

## Dónde vive cada cosa

```
src/modules/buyer/
  password.ts   cifrado y política mínima de contraseña
  session.ts    crear, leer, revocar — la cookie y la tabla
  register.ts   alta y vinculación con el cliente existente
  login.ts      acceso, mensajes iguales y límite de intentos
  guard.ts      requireBuyer() para las pantallas de la cuenta
src/app/(tienda)/cuenta/
  entrar/ crear/ (panel) pedidos/[numero]/
tests/buyer-auth.test.ts
```

**Migración de Prisma:** sí — credenciales en el cliente y tabla de sesiones.

**Eventos:** ninguno.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Un comprador alcanza el panel.** Es el peor fallo posible: el panel confirma pedidos y mueve inventario. | Cookies y verificación separadas —no puede, no es que no deba—, más una prueba que lo fija. |
| **La cuenta filtra pedidos de otros.** El fallo más común de un área privada. | Toda consulta parte de la sesión; el identificador de la dirección solo se usa **después** de comprobar de quién es. Fijado por prueba. |
| **Sin recuperación de contraseña, el soporte lo absorbe WhatsApp.** | Declarado como bloqueo, con el texto que dirige al comprador. Se levanta cuando el dominio tenga registros de correo. |
| **El límite de intentos no sobrevive a un reinicio ni a una segunda instancia.** | Aceptado con una instancia y anotado. Es freno a la fuerza bruta, no auditoría. |
| **Un cliente con dos correos sigue siendo dos clientes.** Ya pasa hoy. | Fuera de alcance: la unificación es del módulo de clientes, no de este change. |

## Migration Plan

1. Esquema: credenciales en el cliente y tabla de sesiones.
2. Contraseña y sesión, **con sus pruebas, antes de cualquier pantalla**.
3. Registro y acceso, incluida la vinculación del comprador antiguo.
4. El guard, y la separación respecto del panel **fijada por prueba**.
5. Las pantallas de la cuenta: cashback y pedidos.
6. El checkout reconoce la sesión.

**Reversión:** quitar el enlace de "Mi cuenta" deja la tienda como está hoy. Nada de lo anterior depende de este change.

## Open Questions

- **¿Quiere el cliente que el comprador pueda borrar su cuenta?** En Colombia el Habeas Data da derecho a supresión, pero borrar un cliente con pedidos rompería el historial de ventas del negocio. La salida habitual es anonimizar conservando el pedido. No bloquea este change; hay que preguntarlo antes del go-live.
- **¿Se le ofrece crear cuenta al invitado que acaba de comprar?** Es el mejor momento para pedirla y no está en el alcance. Se deja fuera y se anota.
