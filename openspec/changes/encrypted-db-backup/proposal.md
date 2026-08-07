# Respaldo cifrado de la base de datos

**Semana del plan:** S16 (24–30 oct, "Producción"), con el DoD *"Restore de backup probado"*. **Se adelanta a hoy** porque dejó de ser una tarea cómoda de S16: al descartarse los snapshots del proveedor por presupuesto (31 jul), este respaldo pasó a ser **la única capa de respaldo del proyecto**.

**HU de referencia:** **ninguna**. No existe HU de respaldos y no debería: es infraestructura, no producto. Está en el plan técnico como DoD de S16.

**Alcance:** dentro de lo cotizado. El plan lo pide explícitamente.

## Why

Hoy **no existe nada**: ni script, ni programación, ni un solo volcado. Si el VPS se pierde —disco, borrado accidental, `DROP TABLE` en la consola equivocada, ransomware— **se pierde el negocio entero**: catálogo, pedidos, clientes, y el libro de Kora Cashback, que es dinero que el sistema le debe a compradores reales.

El riesgo ya no es teórico. Producción tiene base y Redis montados en el VPS, y en cuanto se despliegue la aplicación empezará a acumular pedidos reales. Cada día que la tienda opere sin respaldo es un día en el que el peor caso es irrecuperable.

Y hay una segunda razón, menos evidente: **un respaldo que nunca se restauró no es un respaldo**. La mayoría de los sistemas de copia que fallan no fallan al copiar — fallan al restaurar, meses después, cuando alguien descubre que el volcado estaba truncado, que le faltaba una extensión, o que nadie tiene la clave. Por eso este change no termina con "se sube un archivo": termina con una restauración ejecutada y verificada.

## What Changes

- **Volcado diario de PostgreSQL**, cifrado **antes de salir del servidor** y subido a almacenamiento remoto, con retención de 30 días.
- **Cifrado asimétrico**: el VPS lleva únicamente la **clave pública**. Puede crear respaldos pero **no puede leerlos**. La clave privada vive fuera del servidor, en poder de Daniel.
  - Esto no es celo criptográfico: si alguien compromete el VPS, hoy se llevaría además el histórico completo de respaldos con datos personales de todos los clientes. Con clave pública, se lleva archivos que no puede abrir.
- **El respaldo NO corre dentro de la red interna.** La red `interna` es `internal: true` a propósito —la base no tiene salida a internet— así que un contenedor ahí dentro no podría subir nada, y darle salida rompería la propiedad que ese aislamiento defiende. El volcado se toma desde el anfitrión con `docker exec`, que no necesita red.
- **Verificación de que el respaldo existe y es reciente**, con aviso cuando deja de aparecer. Un respaldo que dejó de correr es indistinguible de uno que corre bien, hasta que se necesita.
- **Procedimiento de restauración escrito y EJECUTADO**, no solo documentado.
- **Restauración de prueba automática**: el ciclo completo —volcar, cifrar, descifrar, restaurar en una base desechable, comprobar que los datos están— corre como parte de la verificación, no como un ritual manual que alguien recuerda una vez al año.

## Capabilities

### New Capabilities
- `database-backup`: creación, cifrado, envío y retención del respaldo de la base.
- `backup-restore`: restauración verificable de un respaldo, y la comprobación de que el ciclo completo funciona de verdad.

### Modified Capabilities
Ninguna.

## Impact

**Código y configuración nuevos**
- `deploy/backup/respaldar.sh` — volcado, cifrado y envío, pensado para correr desde el anfitrión.
- `deploy/backup/restaurar.sh` — restauración a una base indicada, con confirmación explícita.
- `deploy/backup/README.md` — procedimiento de recuperación ante desastre, y cómo se generan y custodian las claves.
- `scripts/verify-backup.ts` + `pnpm backup:verify` — comprobación del ciclo completo contra la base local.
- Entrada de `cron` en el VPS y sus variables en `.env.production`.

**Insumos y decisiones que esto necesita**
1. **Destino del respaldo.** La opción prevista es Cloudflare R2, que también bloquea el despliegue de producción por las imágenes. Es la misma cuenta y la misma decisión pendiente.
2. **Custodia de la clave privada.** Si se pierde, los respaldos son ilegibles y no hay forma de recuperarlos: es la contrapartida de que el VPS no pueda leerlos. Tiene que quedar en el gestor de contraseñas de Daniel **y** en un segundo lugar.

**Fuera de alcance**
- Respaldo de las imágenes de producto: viven en R2, que ya replica, y no son recuperables desde la base de todos modos.
- Recuperación a un punto en el tiempo (WAL archiving / PITR). Es lo correcto para un sistema con transacciones de alto valor por minuto; aquí un volcado diario acota la pérdida a un día de pedidos, que se pueden reconstruir desde WhatsApp. Se declara la limitación en vez de fingir que no existe.
- Respaldo de Redis: hoy no guarda nada que no se pueda reconstruir.
- Respaldo del entorno de pruebas: sus datos son de demostración.
