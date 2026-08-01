## Purpose

Convierte cada integración a la rama principal en un despliegue verificable al entorno de pruebas, y deja la promoción a producción bajo una decisión humana explícita. Cierra la parte del DoD de la Semana 1 que exigía integración continua desplegando desde la rama principal.

## ADDED Requirements

### Requirement: Ninguna integración sin verificación previa

El despliegue SHALL ejecutarse únicamente cuando la verificación automática del proyecto haya pasado por completo: comprobación de tipos, análisis estático, pruebas y compilación.

**Invariante:** si la verificación falla, no se despliega nada. La regla vigente del proyecto —"si no despliega o no pasa el test, no está hecho"— exige que el entorno de pruebas refleje siempre un estado verificado.

#### Scenario: La verificación falla

- **WHEN** se integra a la rama principal un cambio cuyas pruebas o comprobación de tipos fallan
- **THEN** el despliegue no se ejecuta y el entorno de pruebas conserva la versión anterior

#### Scenario: La verificación pasa

- **WHEN** se integra a la rama principal un cambio que pasa la verificación completa
- **THEN** el entorno de pruebas queda actualizado sin intervención manual

### Requirement: Despliegue automático a pruebas, manual a producción

La integración a la rama principal SHALL desplegar automáticamente al entorno de pruebas. El despliegue a producción NO SHALL ocurrir de forma automática: SHALL requerir una aprobación humana explícita.

**Invariante:** ninguna combinación de eventos del repositorio puede publicar en producción sin que una persona lo autorice.

#### Scenario: Integración a la rama principal

- **WHEN** un cambio verificado se integra a la rama principal
- **THEN** se despliega al entorno de pruebas y producción permanece en su versión anterior

#### Scenario: Promoción a producción

- **WHEN** se solicita desplegar a producción
- **THEN** el proceso queda detenido esperando aprobación y solo continúa cuando una persona autorizada la concede

#### Scenario: Rama distinta de la principal

- **WHEN** se integra un cambio a cualquier rama que no sea la principal
- **THEN** se ejecuta la verificación pero no se despliega a ningún entorno

### Requirement: Las migraciones se aplican como parte del despliegue

Toda migración de esquema pendiente SHALL aplicarse automáticamente durante el despliegue, antes de que la nueva versión de la aplicación empiece a recibir tráfico. NO SHALL modificarse el esquema manualmente contra ningún entorno.

**Invariante:** el esquema del entorno siempre corresponde a la versión de la aplicación que está sirviendo. Aplicar migraciones a mano es la vía más directa a una divergencia que nadie recuerda haber causado.

#### Scenario: Despliegue con migración pendiente

- **WHEN** se despliega una versión que incluye una migración no aplicada
- **THEN** la migración se ejecuta antes de que la nueva versión reciba tráfico

#### Scenario: La migración falla

- **WHEN** una migración falla durante el despliegue
- **THEN** el despliegue se detiene, la versión anterior sigue sirviendo y el fallo queda registrado

### Requirement: Credenciales de despliegue dedicadas y de alcance mínimo

El proceso de despliegue SHALL autenticarse contra el servidor con credenciales creadas exclusivamente para ese fin. NO SHALL usarse credenciales personales de ninguna persona del equipo.

**Invariante:** revocar el acceso del despliegue no puede implicar revocar el acceso de una persona, ni al revés. Una credencial personal en un almacén de secretos compartido convierte una fuga del repositorio en una fuga de la identidad de alguien.

#### Scenario: Auditoría de credenciales

- **WHEN** se revisan los secretos configurados en el repositorio
- **THEN** la llave de acceso al servidor es un par generado para el despliegue y no coincide con ninguna llave personal

#### Scenario: Revocación

- **WHEN** se revoca la credencial de despliegue en el servidor
- **THEN** el despliegue automático deja de funcionar y el acceso personal de los desarrolladores permanece intacto

### Requirement: La aplicación se niega a arrancar con configuración incompleta

En producción, la aplicación SHALL verificar **al arrancar** que su configuración de almacenamiento de imágenes está completa, y SHALL terminar inmediatamente con un error si falta. NO SHALL quedar en ejecución para fallar más tarde, al atender la primera petición que la necesite.

El error SHALL nombrar las variables de configuración que faltan.

En desarrollo, donde las imágenes se sirven desde disco local, la ausencia de esa configuración NO SHALL impedir el arranque.

**Invariante:** un contenedor en ejecución significa un entorno que puede servir. Si arranca sin poder servir imágenes, se reporta sano ante cualquier verificación de salud mientras la tienda está rota, y el fallo lo descubre el primer cliente en vez del despliegue. La comprobación perezosa convierte un error de configuración —barato, visible al desplegar— en una caída en producción.

#### Scenario: Producción sin configuración de almacenamiento

- **WHEN** se arranca la aplicación en modo producción sin las variables del almacenamiento de imágenes
- **THEN** el proceso termina de inmediato con un error que nombra las variables faltantes, y en ningún momento acepta peticiones

#### Scenario: Producción con configuración completa

- **WHEN** se arranca la aplicación en modo producción con todas las variables presentes
- **THEN** arranca con normalidad y sirve peticiones

#### Scenario: Desarrollo sin configuración de almacenamiento

- **WHEN** se arranca la aplicación en modo desarrollo sin las variables del almacenamiento remoto
- **THEN** arranca con normalidad y las imágenes se sirven desde el disco local

#### Scenario: Despliegue con configuración incompleta

- **WHEN** se despliega una versión a un entorno cuyas variables de almacenamiento están incompletas
- **THEN** el despliegue falla de forma visible y la versión anterior sigue sirviendo, en lugar de promover un entorno que se reporta sano y no puede mostrar productos

### Requirement: Un despliegue fallido no deja el entorno inservible

Si el despliegue falla en cualquier paso, el entorno afectado SHALL quedar sirviendo la última versión que funcionaba.

#### Scenario: La nueva versión no arranca

- **WHEN** la nueva versión falla al iniciar durante un despliegue
- **THEN** el entorno sigue respondiendo con la versión anterior y el fallo queda registrado

#### Scenario: Registro del despliegue

- **WHEN** se consulta el historial de despliegues
- **THEN** consta qué versión está sirviendo cada entorno y cuándo fue desplegada
