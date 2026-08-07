// ¿Sigue ocurriendo el respaldo?
//
//   pnpm backup:status
//
// Lee el registro que deja `deploy/backup/respaldar.sh`. Sale con código
// distinto de cero cuando el respaldo está atrasado o nunca ha corrido, para
// que pueda encadenarse en una comprobación automática.
//
// Ver openspec/changes/encrypted-db-backup — specs/database-backup.

import { existsSync, readFileSync } from "node:fs";
import { describeBackupStatus, parseBackupLog } from "../src/modules/backup/status";

const REGISTRO = process.env.KORA_BACKUP_LOG ?? "/var/log/kora-backup.log";

function main(): void {
  if (!existsSync(REGISTRO)) {
    // Un registro que no existe no es "no hay noticias": es que el respaldo
    // nunca se instaló, o se instaló en otro sitio.
    console.error(
      `\n✖ No existe el registro de respaldos en '${REGISTRO}'.\n` +
        "  Significa que NUNCA se ha completado un respaldo en esta máquina, o que\n" +
        "  KORA_BACKUP_LOG apunta a otro sitio. Ver deploy/backup/README.md.\n",
    );
    process.exit(1);
  }

  const estado = parseBackupLog(readFileSync(REGISTRO, "utf8"));
  console.log(`\n${describeBackupStatus(estado)}\n`);

  process.exit(estado.estado === "ok" ? 0 : 1);
}

main();
