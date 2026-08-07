# Respaldos de KORA — creación y recuperación ante desastre

> **Última restauración real ejecutada:** ⛔ **NINGUNA todavía.**
> Hasta que esta línea tenga una fecha, el DoD de S16 (*"Restore de backup probado"*) **no está cumplido**, y este sistema es una suposición con formato de documento. El ciclo completo sí está verificado contra la base local (`pnpm backup:verify`).

## Qué protege esto, y qué no

Un archivo diario cifrado con **la base de producción Y las imágenes de producto**, con retención de 30 días.

**Van juntos en un solo archivo a propósito.** Separados podrían desincronizarse —la base de hoy con las fotos de ayer— y obligarían a acertar la pareja durante una recuperación, con prisa. Además, restaurar solo la base dejaría el catálogo completo sin una sola foto, y la aplicación **ni siquiera arrancaría**: comprueba al iniciar que las imágenes que la base registra existan de verdad.

Con `KORA_STORAGE_DRIVER=r2` las imágenes viven fuera del servidor y el respaldo no las incluye; lo anota en su registro para que nadie lea el tamaño del archivo y suponga que están dentro.

**En el peor caso se pierde hasta un día de pedidos.** No hay recuperación a un punto intermedio del día (PITR): eso exige archivado de WAL y no está construido. La pérdida es acotable porque el cobro ocurre por WhatsApp — los pedidos del día se pueden reconstruir desde esas conversaciones. **Se dice aquí en vez de disimularlo.**

No cubre: Redis (no guarda nada irrecuperable) ni el entorno de pruebas (datos de demostración).

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

El destino tiene que estar **fuera del servidor**. Un respaldo en el mismo disco que protege no es un respaldo: el escenario principal es perder la máquina.

**Sin tarjeta (situación actual, 7 ago 2026):** Cloudflare R2 exige registrar una tarjeta y se descartó por eso, así que el destino tampoco puede ser R2. La opción viable es **Google Drive**, que `rclone` soporta de forma nativa: 15 GB gratuitos, sin tarjeta, y basta con la cuenta de Google que ya existe.

```bash
rclone config
# tipo: drive · autorizar con la cuenta de Google
# nombre del remoto: respaldos
```

Que Google no pueda leerlos está garantizado por el cifrado: los archivos salen del servidor ya cifrados con la clave pública, así que el proveedor almacena bytes que no puede abrir. Esa es otra razón por la que el cifrado va antes del envío y no en el destino.

**Con tarjeta**, si algún día la hay:

```bash
rclone config
# tipo: s3 · proveedor: Cloudflare R2 · endpoint: https://<cuenta>.r2.cloudflarestorage.com
# nombre del remoto: r2
```

⚠️ **Cuidado con el cupo:** con las imágenes dentro, el respaldo pasa de ~85 KiB a algunos GB. Con 1,2 GB de fotos y 30 días de retención se rozan los 15 GB de Drive. Dos salidas, ambas de una línea: bajar la retención a 14 días, o separar las imágenes en un respaldo semanal. **Revisar el cupo cuando entre el catálogo real.**

### 4. Variables en `.env.production`

```
KORA_BACKUP_CONTAINER=kora-prod-postgres
KORA_BACKUP_REMOTE=respaldos:kora-respaldos/produccion
KORA_BACKUP_AGE_RECIPIENT=age1xxxxxxxx...      # la PÚBLICA
KORA_BACKUP_RETENTION_DAYS=30
KORA_BACKUP_LOG=/var/log/kora-backup.log
KORA_BACKUP_UPLOADS_VOLUME=kora-prod_uploads
```

> El volumen de imágenes se lee con un contenedor efímero (`docker run --rm -v … alpine tar`) y no por una ruta del anfitrión: un volumen de Docker vive bajo `/var/lib/docker` con permisos de root, y un bind mount traería el problema de que el usuario del contenedor y el del anfitrión coincidan. Así no depende de ninguna de las dos cosas.

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
rclone lsf respaldos:kora-respaldos/produccion | tail -3
pnpm backup:status                   # debe decir "Último respaldo: …"
```

**Y luego el paso 7, que es el que casi nadie hace.**

### 7. Restaurar de verdad, y anotar la fecha arriba

```bash
rclone copy <remoto>:kora-respaldos/produccion/kora-<sello>.tar.age .
./restaurar.sh --archivo kora-<sello>.tar.age \
               --clave ~/kora-backup.key \
               --base kora_prueba_restauracion \
               --volumen kora_prueba_uploads
```

Comprobar que los datos están:

```sql
SELECT count(*) FROM orders;
SELECT count(*) FROM customers;
SELECT count(*) FROM cashback_movements;
SELECT count(*) FROM product_images;   -- debe cuadrar con los archivos restaurados
```

Contrastar contra la base de producción. Si cuadran, **escribe la fecha en la primera línea de este documento** y borra `kora_prueba_restauracion`.

## Recuperación ante desastre — el servidor se perdió

Escrito para que lo siga alguien que no construyó esto, con prisa.

1. **Montar un servidor nuevo** siguiendo la reconstrucción desde cero de `../README.md`.
2. **Traer la clave privada** de donde esté custodiada. Sin ella no se sigue: los respaldos no se pueden abrir.
3. **Instalar `age` y `rclone`**, y configurar el remoto (pasos 2 y 3 de arriba).
4. **Bajar el respaldo más reciente**:
   ```bash
   rclone lsf respaldos:kora-respaldos/produccion | sort | tail -1
   rclone copy respaldos:kora-respaldos/produccion/<ese archivo> .
   ```
5. **Levantar solo la base**:
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres
   ```
6. **Restaurar sobre la base de producción**, indicándola explícitamente:
   ```bash
   ./restaurar.sh --archivo <archivo>.tar.age --clave <clave> --base kora \
                  --volumen kora-prod_uploads
   ```
   Esto restaura la base **y** las imágenes. Si se omite el volumen, la
   aplicación no arrancará: detecta que la base registra fotos que no existen.
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
