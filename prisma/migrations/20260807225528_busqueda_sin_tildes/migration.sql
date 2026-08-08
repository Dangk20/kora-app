-- Búsqueda que no depende de las tildes.
--
-- Sin esto, quien escribe "audifonos" no encuentra "Audífonos" y quien escribe
-- "Audífonos" no encuentra "AUDIFONOS" — y el catálogo real lo va a cargar el
-- cliente a mano, con y sin tilde en la misma sesión. El visitante no ve un
-- error: ve una tienda que no tiene lo que sí tiene.
--
-- `unaccent` viene con la distribución de PostgreSQL (contrib), así que no
-- añade dependencias que instalar aparte.
CREATE EXTENSION IF NOT EXISTS unaccent;
