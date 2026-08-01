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

## Lo que todavía no está

- **Gastar el saldo en el checkout.** `consumeCashback()` está construido y
  probado, pero nada lo llama: conectarlo toca `createOrder()` e implica la
  exclusión mutua con cupones que el cliente definió. Change aparte.
- **Recálculo por cambio de producto** (ventana de 30 días). Falta confirmar con
  el cliente si la diferencia se acredita cuando el recálculo sube.
- **El perfil del comprador en la tienda.** Depende del módulo de cuenta, que no
  existe.
