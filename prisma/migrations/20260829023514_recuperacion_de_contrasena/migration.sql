-- Recuperación de contraseña del comprador, por código al correo.
--
-- Estuvo bloqueada desde julio porque el dominio no podía enviar correo; el
-- 28 ago 2026 se resolvió y esto es lo que faltaba.
--
-- Se guarda el HASH del código y no el código. Un código de seis dígitos es una
-- credencial: quien pueda leer esta tabla no debe poder entrar en ninguna
-- cuenta con lo que ve. Es el mismo criterio que ya rige las contraseñas y las
-- sesiones del comprador.
--
-- `attempts` no es diagnóstico: seis dígitos son un millón de combinaciones y
-- sin límite de intentos un guion las prueba en minutos.
CREATE TABLE "password_resets" (
    "id"         TEXT NOT NULL,
    "codeHash"   TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "usedAt"     TIMESTAMP(3),
    "attempts"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_resets_codeHash_key" ON "password_resets"("codeHash");
CREATE INDEX "password_resets_customerId_createdAt_idx" ON "password_resets"("customerId", "createdAt");

-- Al borrar un cliente se van sus códigos: no tiene sentido conservar una
-- credencial de una cuenta que ya no existe.
ALTER TABLE "password_resets"
  ADD CONSTRAINT "password_resets_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
