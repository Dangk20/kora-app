// Máquina de estados de una campaña.
// Ver openspec/changes/email-marketing — specs/email-campaigns.
//
// Mismo criterio que gobierna el estado de un pedido: las transiciones son las
// únicas permitidas y el estado nunca retrocede. Editar una campaña que ya está
// saliendo produce dos correos distintos bajo el mismo nombre, y ya no hay
// forma de saber qué recibió cada quien.

import type { CampaignStatus } from "@/generated/prisma/enums";

const PERMITIDAS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["SCHEDULED", "SENDING"],
  SCHEDULED: ["SENDING", "CANCELLED", "DRAFT"],
  SENDING: ["SENT"],
  // Terminales: una campaña enviada es histórico. Cancelada se duplica, no se
  // revive — reabrirla haría que su registro dejara de explicar lo que pasó.
  SENT: [],
  CANCELLED: [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return PERMITIDAS[from].includes(to);
}

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "Borrador",
  SCHEDULED: "Programada",
  SENDING: "Enviando",
  SENT: "Enviada",
  CANCELLED: "Cancelada",
};

/** Se puede editar mientras no haya salido ni un correo. */
export function isEditable(status: CampaignStatus): boolean {
  return status === "DRAFT" || status === "SCHEDULED";
}

/** Se puede borrar solo un borrador: lo demás es histórico. */
export function isDeletable(status: CampaignStatus): boolean {
  return status === "DRAFT";
}

/** Cancelar solo tiene sentido antes de que empiece a salir. */
export function isCancellable(status: CampaignStatus): boolean {
  return status === "SCHEDULED";
}
