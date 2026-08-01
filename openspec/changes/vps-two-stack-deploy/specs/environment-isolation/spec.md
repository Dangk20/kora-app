## Purpose

Permite que los entornos de pruebas y de producción convivan en una sola máquina sin poder afectarse entre sí, ni por acceso a datos ni por consumo de recursos. Es la condición que hace aceptable ahorrar un servidor sin poner en riesgo la tienda real.

## ADDED Requirements

### Requirement: Separación total de datos entre entornos

Cada entorno SHALL tener su propia base de datos, su propio almacén de caché y sus propios volúmenes de persistencia. Un proceso del entorno de pruebas NO SHALL poder leer ni escribir datos del entorno de producción por ninguna vía de red, credencial o volumen compartido.

**Invariante:** no existe ninguna combinación de credenciales, nombre de servicio o ruta de volumen que permita a un contenedor de pruebas alcanzar la base de producción. La separación es estructural, no una convención de configuración.

#### Scenario: Un contenedor de pruebas intenta alcanzar la base de producción

- **WHEN** se abre una consola dentro de cualquier contenedor del entorno de pruebas y se intenta resolver o conectar al servicio de base de datos de producción
- **THEN** la conexión falla por resolución de nombre o por ruta de red inalcanzable, y no por credenciales incorrectas

#### Scenario: Credenciales cruzadas

- **WHEN** se toma la cadena de conexión del entorno de producción y se usa desde el entorno de pruebas
- **THEN** la conexión no se establece, porque el servicio de producción no es alcanzable desde la red del entorno de pruebas

#### Scenario: Los volúmenes no se comparten

- **WHEN** se inspeccionan los volúmenes de persistencia declarados por ambos entornos
- **THEN** ninguno aparece referenciado por los dos, y borrar por completo el entorno de pruebas deja intactos los datos de producción

### Requirement: Presupuesto acotado de memoria y CPU

Cada contenedor SHALL declarar un límite máximo de memoria y de CPU. La suma de los límites de todos los contenedores NO SHALL exceder la memoria física disponible menos un margen reservado para el sistema operativo.

**Invariante:** producción tiene asignado más presupuesto que pruebas. Un proceso desbocado en pruebas es detenido por su propio límite antes de poder consumir la memoria que producción necesita.

#### Scenario: Carga sostenida en pruebas

- **WHEN** el entorno de pruebas recibe carga sostenida hasta agotar el límite de memoria de sus contenedores
- **THEN** el contenedor afectado de pruebas es reiniciado por haber excedido su límite, y las peticiones a producción siguen respondiendo con normalidad

#### Scenario: El presupuesto declarado cabe en la máquina

- **WHEN** se suman los límites de memoria de todos los contenedores de ambos entornos
- **THEN** el total deja libre un margen para el sistema operativo, y ese margen queda documentado

### Requirement: Los secretos no viven en el repositorio

Cada entorno SHALL tomar su configuración sensible de un archivo de variables de entorno presente únicamente en el servidor. El repositorio SHALL contener solo plantillas sin valores reales.

**Invariante:** cada entorno usa contraseñas de base de datos y secretos de sesión distintos. Comprometer el entorno de pruebas no entrega ninguna credencial válida en producción.

#### Scenario: Auditoría del repositorio

- **WHEN** se revisa el contenido versionado del repositorio en busca de contraseñas, secretos de sesión o credenciales de almacenamiento
- **THEN** solo se encuentran plantillas de ejemplo con valores marcados como tales

#### Scenario: Los secretos difieren entre entornos

- **WHEN** se comparan las credenciales efectivas de ambos entornos en el servidor
- **THEN** ningún valor sensible coincide entre pruebas y producción

### Requirement: El servidor es reconstruible desde el repositorio

La definición completa de ambos entornos SHALL estar versionada en el repositorio. Partiendo de un servidor recién aprovisionado y de los archivos de secretos custodiados aparte, SHALL ser posible restaurar el servicio sin conocimiento no escrito.

**Invariante:** al no existir copias de imagen del servidor, esta propiedad es la única vía de recuperación ante un fallo total de la máquina.

#### Scenario: Reconstrucción desde cero

- **WHEN** se sigue el procedimiento documentado sobre una máquina limpia, aportando únicamente los archivos de secretos
- **THEN** ambos entornos quedan levantados y sirviendo, sin pasos manuales que no estén escritos

#### Scenario: Nada esencial vive solo en la máquina

- **WHEN** se inventaría qué archivos del servidor no están en el repositorio
- **THEN** el único resultado son los archivos de variables de entorno con secretos y los datos de las bases
