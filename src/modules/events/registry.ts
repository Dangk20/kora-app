// Registro de manejadores por tipo de evento.
//
// Añadir un consumidor nuevo es registrarlo aquí: el motor de consumo
// (`consumer.ts`) no cambia. Ver openspec/changes/outbox-worker — design.md §4.

import type { EventHandler } from "./types";

const registry = new Map<string, EventHandler[]>();

/** Registra un manejador para un tipo de evento. Un tipo admite varios. */
export function registerHandler(eventType: string, handler: EventHandler): void {
  const existing = registry.get(eventType) ?? [];
  if (existing.some((h) => h.name === handler.name)) {
    throw new Error(
      `Ya hay un manejador llamado "${handler.name}" para "${eventType}". ` +
        "Los nombres deben ser únicos por tipo: son lo que identifica al manejador en los registros.",
    );
  }
  registry.set(eventType, [...existing, handler]);
}

export function handlersFor(eventType: string): EventHandler[] {
  return registry.get(eventType) ?? [];
}

/** Tipos que hoy tienen quien los atienda. */
export function registeredTypes(): string[] {
  return [...registry.keys()].sort();
}

/** Solo para pruebas: deja el registro vacío. */
export function resetRegistry(): void {
  registry.clear();
}
