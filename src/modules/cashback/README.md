# Kora Cashback

El 3 % de cada compra vuelve al cliente como saldo gastable en la siguiente.
Reglas del cliente: `../../../../business/kora-cashback-reglas-cliente.md`.
Requisitos: `openspec/changes/kora-cashback/specs/`.

## Lo que este módulo garantiza

**El saldo solo cambia aquí.** `ledger.ts` es el único camino por el que
`cashbackCop` o `cashbackUsd` pueden moverse: bloqueo de la fila del cliente,
movimiento en el libro y materialización del saldo, todo en la misma
transacción. Es la regla 1 del proyecto —la que gobierna el stock— aplicada a
dinero. Ni seeds, ni importadores, ni server actions se lo saltan.

Un saldo que no cuadra con su libro es un pasivo que nadie puede auditar: no se
sabe si sobra porque se acreditó de más o falta porque se consumió sin
registrar. Por eso `verify.ts` existe y por eso **avisa sin corregir**.

**Las dos monedas son dos bolsas.** No existe tasa de cambio en KORA y es
deliberado. El tipo `CashbackBalance` no es un número: sumar pesos con dólares
no compila sin que alguien lo decida a propósito.

**Acreditar dos veces es imposible.** El manejador de `order.confirmed`
comprueba el rastro en el libro antes de acreditar. La entrega de la bandeja de
salida es *al menos una vez*, y aquí lo que se duplicaría es dinero — un error
que nadie reporta, porque nadie se queja de que le den de más.

## Los archivos

| Archivo | Qué hace |
|---|---|
| `money.ts` | Los dos importes por moneda, el truncado hacia abajo y la vigencia de 12 meses |
| `ledger.ts` | Acreditar, consumir por antigüedad y vencer — con su materialización |
| `accrual.ts` | Cuánto genera una compra. Función pura, sin base de datos |
| `balance.ts` | Solo lectura: disponible, lotes vigentes, historial y pendiente derivado |
| `redemption.ts` | Cuánto puede aplicar el comprador y por qué no |
| `refund.ts` | Devolución a los lotes originales, por saldo neto |
| `verify.ts` | Comprobación contable — `pnpm cashback:verify` |

## Por qué lotes y no un saldo

Un saldo único no puede responder qué parte caduca el mes que viene. Cada
acreditación abre un **lote** con su moneda, su pedido de origen y su
vencimiento propio. El consumo gasta del lote **más próximo a vencer**: gastar
el más nuevo primero dejaría el saldo antiguo caducando mientras el cliente cree
que lo está usando.

Vencer **no borra**: escribe un movimiento negativo y deja el remanente en cero.
Si venciera borrando, un cliente que reclama "yo tenía cashback" no tendría
respuesta.

## Disponible vs. pendiente

**Disponible** sale de los saldos materializados: pedidos ya confirmados,
gastable. **Pendiente** se *deriva* de los pedidos creados sin confirmar y no
genera lotes — si los generara, un pedido expirado dejaría saldo fantasma.

## Gastar el saldo

Solo el **comprador con sesión** puede canjear: sin cuenta, su identidad sería
el correo que escribió en un formulario, y eso dejaría gastar el saldo ajeno.
**No se combina con cupones** (regla del cliente), y el importe lo decide
siempre el servidor: del navegador solo llega la intención.

**El saldo se descuenta al CREAR el pedido**, no al confirmarlo — lo contrario
de lo que hace el stock, y a propósito. Reservar stock se lo quita a otros
compradores; el cashback es del propio comprador. Y descontarlo al confirmar
dejaría que dos pedidos pendientes comprometieran el mismo saldo, haciendo
**fallar `confirmOrder()`** con el operador al teléfono cerrando un cobro: el
peor sitio posible para un error.

Si el pedido **expira o se cancela**, el saldo vuelve **a sus lotes originales**
con su vencimiento intacto. Un lote nuevo le daría 12 meses de vida a un saldo
por caducar, y bastaría abandonar pedidos para renovarlo para siempre. La
devolución se calcula por **saldo neto por lote**, no por "¿ya devolví?": un
pedido puede cancelarse, devolver, reabrirse —volviendo a gastar— y cancelarse
otra vez.

## Lo que todavía no está

- **Recálculo por cambio de producto** (ventana de 30 días). Falta confirmar con
  el cliente si la diferencia se acredita cuando el recálculo sube.
- **Canje en el POS.** El POS todavía no existe.
- **Que el operador aplique saldo desde el panel** al cerrar el cobro por
  WhatsApp. Implicaría que mueva dinero de un cliente: necesita permiso propio y
  registro de quién lo hizo.

⚠️ `computeAccrual()` recibe el **total del pedido**, que ya viene neto del cupón
y del cashback aplicado. Restarle otra vez el saldo descontaría dos veces.
