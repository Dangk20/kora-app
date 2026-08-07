# Respaldos de KORA — creación y recuperación ante desastre

> **Última restauración real ejecutada:** ⛔ **NINGUNA todavía.**
> Hasta que esta línea tenga una fecha, el DoD de S16 (*"Restore de backup probado"*) **no está cumplido**, y este sistema es una suposición con formato de documento. El ciclo completo sí está verificado contra la base local (`pnpm backup:verify`).

## Qué protege esto, y qué no

Un volcado diario cifrado de la base de producción, con retención de 30 días.

**En el peor caso se pierde hasta un día de pedidos.** No hay recuperación a un punto intermedio del día (PITR): eso exige archivado de WAL y no está construido. La pérdida es acotable porque el cobro ocurre por WhatsApp — los pedidos del día se pueden reconstruir desde esas conversaciones. **Se dice aquí en vez de disimularlo.**

No cubre: imágenes de producto (viven en R2 y no se recuperan desde la base), Redis (no guarda nada irrecuperable) ni el entorno de pruebas (datos de demostración).

## La decisión que hay que entender antes de tocar nada

**El servidor puede crear respaldos y NO puede leerlos.** Lleva solo la clave *pública*.

Si alguien compromete el VPS, no se lleva además el histórico completo de datos personales de todos los clientes: se lleva archivos que no puede abrir.

**La contrapartida es absoluta: si se pierde la clave privada, los respaldos son basura.** No hay recuperación, ni soporte, ni reseteo. Por eso:

- La clave privada **no vive en el servidor**. Nunca.
- Se custodia en **dos** lugares: el gestor de contraseñas de Daniel y un segundo sitio independiente.
- `pnpm backup:verify` ejercita el descifrado en cada ejecución, para que una clave rota se descubra en desarrollo y no durante una recuperación.

## Instalación en el VPS

### 1. Generar el par de claves — **en una máquina local, no en el servidor**

```bash
age-keygen -o kora-backup.key
# Imprime: Public key: age1xxxxxxxx...
```

- `kora-backup.key` es la **privada**. Guárdala en los dos sitios y **bórrala de la máquina donde la generaste** si no es de confianza.
- La línea `age1...` es la **pública**. Esa sí va al servidor.

### 2. Instalar las herramientas en el VPS

```bash
sudo apt-get update && sudo apt-get install -y age rclone
```

> Estos dos binarios viven **fuera** del `docker compose`, así que reconstruir el servidor sin instalarlos deja el sistema sin copias. Están anotados en la reconstrucción desde cero de `../README.md`.

### 3. Configurar el destino remoto

```bash
rclone config
# tipo: s3 · proveedor: Cloudflare R2 · endpoint: https://<cuenta>.r2.cloudflarestorage.com
# nombre del remoto: r2
```

### 4. Variables en `.env.production`

```
KORA_BACKUP_CONTAINER=kora-prod-postgres
KORA_BACKUP_REMOTE=r2:kora-respaldos/produccion
KORA_BACKUP_AGE_RECIPIENT=age1xxxxxxxx...      # la PÚBLICA
KORA_BACKUP_RETENTION_DAYS=30
KORA_BACKUP_LOG=/var/log/kora-backup.log
```

### 5. Programarlo

```bash
sudo touch /var/log/kora-backup.log && sudo chown deploy /var/log/kora-backup.log
crontab -e
```

```cron
# 03:30 Colombia (08:30 UTC) — después del despliegue nocturno de las 02:00 y
# lejos del tráfico de la tienda.
30 8 * * * /home/deploy/kora/deploy/backup/respaldar.sh >> /var/log/kora-backup.log 2>&1
```

### 6. Probarlo de verdad, el mismo día

```bash
./respaldar.sh                       # debe terminar en 0 y dejar una línea OK
rclone lsf r2:kora-respaldos/produccion | tail -3
pnpm backup:status                   # debe decir "Último respaldo: …"
```

**Y luego el paso 7, que es el que casi nadie hace.**

### 7. Restaurar de verdad, y anotar la fecha arriba

```bash
rclone copy r2:kora-respaldos/produccion/kora-<sello>.dump.age .
./restaurar.sh --archivo kora-<sello>.dump.age \
               --clave ~/kora-backup.key \
               --base kora_prueba_restauracion
```

Comprobar que los datos están:

```sql
SELECT count(*) FROM orders;
SELECT count(*) FROM customers;
SELECT count(*) FROM cashback_movements;
```

Contrastar contra la base de producción. Si cuadran, **escribe la fecha en la primera línea de este documento** y borra `kora_prueba_restauracion`.

## Recuperación ante desastre — el servidor se perdió

Escrito para que lo siga alguien que no construyó esto, con prisa.

1. **Montar un servidor nuevo** siguiendo la reconstrucción desde cero de `../README.md`.
2. **Traer la clave privada** de donde esté custodiada. Sin ella no se sigue: los respaldos no se pueden abrir.
3. **Instalar `age` y `rclone`**, y configurar el remoto (pasos 2 y 3 de arriba).
4. **Bajar el respaldo más reciente**:
   ```bash
   rclone lsf r2:kora-respaldos/produccion | sort | tail -1
   rclone copy r2:kora-respaldos/produccion/<ese archivo> .
   ```
5. **Levantar solo la base**:
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres
   ```
6. **Restaurar sobre la base de producción**, indicándola explícitamente:
   ```bash
   ./restaurar.sh --archivo <archivo>.dump.age --clave <clave> --base kora
   ```
7. **Comprobar antes de abrir la tienda**: conteos de `orders`, `customers`, `cashback_movements` y `stock_movements`, y que el último pedido tenga la fecha esperada.
8. **Levantar el resto** (`app`, `worker`, `redis`) y verificar el acceso al panel.
9. **Reconstruir el día perdido** desde las conversaciones de WhatsApp: los pedidos posteriores al respaldo no están.

## Por qué el respaldo corre en el anfitrión y no en un contenedor

La red `interna` es `internal: true`: la base **no tiene salida a internet**, a propósito, y está demostrado con evidencia (ver `../README.md`). Un contenedor de respaldo dentro de esa red no podría subir nada a ningún sitio.

La única forma de que subiera sería darle además una red con internet — es decir, un contenedor con acceso completo a la base **y** salida al exterior: exactamente la ruta de exfiltración que ese aislamiento existe para no tener. Se estaría pagando una propiedad de seguridad real por una comodidad de despliegue.

`docker exec` entra por el socket de Docker y **no usa red**. El volcado sale sin abrir un solo puerto.

## Por qué no lo hace el programador de trabajos de la aplicación

`src/modules/jobs/` ya tiene cerrojo en base, reintentos y diagnóstico, y sería lo natural. Se descartó por una razón que pesa más:

**El respaldo tiene que seguir funcionando cuando la aplicación no funciona.** Un despliegue roto, una migración fallida, un `OOM` del worker o una imagen que no arranca son justo los momentos en que más falta hace un respaldo, y son los momentos en que el programador está caído. Un sistema de copias que comparte destino con lo que debe proteger no es una copia.

## Comandos

| Comando | Qué hace |
|---|---|
| `./respaldar.sh` | Vuelca, cifra, sube y rota. Lo llama `cron`. |
| `./restaurar.sh --archivo X --clave Y --base Z` | Descifra y restaura. Destino siempre explícito. |
| `pnpm backup:verify` | Ciclo completo contra la base local, incluido que un respaldo truncado falle. |
| `pnpm backup:status` | Si el respaldo dejó de ocurrir. Sale ≠0 cuando está atrasado o nunca corrió. |
