-- Solo puede haber UNA ejecución en vuelo por trabajo.
--
-- Es la garantía de exclusión, y vive en la base a propósito: una comprobación
-- en el código (`INSERT ... WHERE NOT EXISTS`) no es atómica —dos ejecuciones
-- simultáneas pueden verse ambas como "no existe" y ambas insertar—. La
-- expiración cancela pedidos: dos ejecuciones a la vez compiten por el mismo.
--
-- Parcial sobre `finishedAt IS NULL`: solo restringe lo que está en vuelo, y
-- deja crecer libremente el historial de ejecuciones terminadas.
CREATE UNIQUE INDEX "job_runs_uno_en_vuelo"
  ON "job_runs" ("job")
  WHERE "finishedAt" IS NULL;
