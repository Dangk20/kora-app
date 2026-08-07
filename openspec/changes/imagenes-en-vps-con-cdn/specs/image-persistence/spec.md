## Purpose

Dónde viven las imágenes de producto, cómo se elige ese destino, y la garantía de que ningún despliegue puede borrarlas sin que nada falle.

## ADDED Requirements

### Requirement: El destino de las imágenes se elige explícitamente

El sistema SHALL leer el destino de las imágenes de una variable de entorno con dos valores admitidos: disco del servidor o almacenamiento remoto.

En producción esa variable SHALL ser obligatoria y SHALL carecer de valor por defecto. El sistema NO SHALL recurrir a un destino alternativo cuando la configuración del elegido esté incompleta: SHALL terminar al arrancar.

Un respaldo automático parece prudente y es lo contrario. Con él, un error de tecleo en una credencial del almacenamiento remoto no produce ningún error: las imágenes se guardan en el disco efímero del contenedor, la aplicación arranca, el operador sube fotos con normalidad, y el siguiente despliegue las borra todas.

#### Scenario: Producción sin destino elegido

- **WHEN** el proceso arranca en producción sin la variable de destino
- **THEN** escribe qué falta y termina con código distinto de cero, sin aceptar peticiones

#### Scenario: Destino remoto elegido con credenciales incompletas

- **WHEN** el proceso arranca en producción con destino remoto y falta alguna de sus credenciales
- **THEN** termina con error nombrando las que faltan, y **no** cae a disco

#### Scenario: Destino de disco elegido sin directorio configurado

- **WHEN** el proceso arranca en producción con destino de disco y sin directorio de subidas configurado
- **THEN** termina con error

#### Scenario: Valor no reconocido

- **WHEN** la variable de destino tiene un valor que no es ninguno de los dos admitidos
- **THEN** el proceso termina con error indicando los valores válidos

#### Scenario: Desarrollo sigue funcionando sin configurar nada

- **WHEN** un desarrollador clona el repositorio y arranca sin variables de almacenamiento
- **THEN** la aplicación arranca y guarda las imágenes en disco, como hasta ahora

### Requirement: Un despliegue no puede borrar las imágenes en silencio

Cuando el destino sea el disco del servidor, el sistema SHALL comprobar al arrancar que el almacenamiento **persiste**: si la base de datos registra imágenes de producto y el directorio de subidas no contiene ninguna, el proceso SHALL terminar con código distinto de cero.

Es el modo de fallo que puede destruir el trabajo del cliente sin producir un solo error. Si el directorio de subidas no está montado sobre un volumen, vive en la capa efímera del contenedor y **cada despliegue borra todas las fotos**. La tienda seguiría respondiendo con normalidad, con el catálogo completo y sin una sola imagen — y ese catálogo lo cargó el cliente a mano.

#### Scenario: El volumen no está montado

- **WHEN** el proceso arranca con destino de disco, la base registra imágenes de producto y el directorio de subidas está vacío
- **THEN** el proceso explica que el almacenamiento no está persistiendo y termina con código distinto de cero

#### Scenario: Instalación nueva sin imágenes todavía

- **WHEN** el proceso arranca con destino de disco, el directorio vacío y la base **sin** ninguna imagen registrada
- **THEN** el proceso arranca con normalidad: no hay nada que se haya perdido

#### Scenario: Todo en orden

- **WHEN** la base registra imágenes y el directorio de subidas contiene archivos
- **THEN** el proceso arranca con normalidad

#### Scenario: La comprobación no aplica al destino remoto

- **WHEN** el destino es el almacenamiento remoto
- **THEN** no se comprueba el directorio local, porque ahí no vive nada

### Requirement: Las imágenes se sirven con caché largo cuando viven en el servidor

Cuando el destino sea el disco, el sistema SHALL servir las imágenes de producto por una ruta pública, en producción, con cabecera de caché inmutable de un año.

Las claves de imagen son únicas e irrepetibles por subida, así que un objeto nunca cambia de contenido: el CDN puede quedárselo para siempre y el servidor entrega cada imagen **una vez**. Sin ese caché, el CDN vuelve a preguntar y el ahorro de ancho de banda —la razón de poner el CDN— desaparece.

Cuando el destino sea remoto, esa ruta SHALL responder 404 en producción: si las imágenes viven fuera, el servidor no sirve ninguna.

#### Scenario: Imagen servida con destino de disco en producción

- **WHEN** se pide una imagen existente por su clave, en producción y con destino de disco
- **THEN** se devuelve el archivo con su tipo de contenido correcto y caché pública inmutable de un año

#### Scenario: La misma ruta con destino remoto

- **WHEN** se pide una imagen por esa ruta en producción y con destino remoto
- **THEN** la respuesta es 404

#### Scenario: Una clave que intenta salirse del directorio

- **WHEN** se pide una clave que contiene rutas relativas hacia arriba o una ruta absoluta
- **THEN** la respuesta es un error de petición y no se lee ningún archivo fuera del directorio de subidas

### Requirement: Las imágenes entran en el respaldo cifrado

El respaldo SHALL incluir el directorio de subidas cuando el destino sea el disco, dentro del mismo archivo cifrado que la base de datos y con la misma retención.

Sin esto, restaurar el sistema devolvería el catálogo con todos sus productos y sin una sola foto — y las fotos son un insumo del cliente que costó semanas conseguir.

#### Scenario: Contenido del respaldo

- **WHEN** se ejecuta un respaldo con destino de disco
- **THEN** el archivo cifrado contiene el volcado de la base **y** las imágenes de producto

#### Scenario: Restauración completa

- **WHEN** se restaura ese respaldo en un servidor nuevo
- **THEN** quedan disponibles tanto los datos como los archivos de imagen, y las fichas de producto muestran sus fotos

#### Scenario: Destino remoto

- **WHEN** se ejecuta un respaldo con destino remoto
- **THEN** el respaldo no intenta incluir imágenes locales, y lo indica en su registro
