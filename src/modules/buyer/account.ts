// Registro y acceso del comprador.
// Ver openspec/changes/cuenta-comprador — specs/buyer-authentication.
//
// Regla que atraviesa todo este archivo: NINGUNA respuesta revela si un correo
// tiene cuenta. Distinguir "ese correo ya existe" de "correo o contraseña
// incorrectos" convierte el formulario en un comprobador de clientela —
// cualquiera va probando correos y saca la lista de compradores de KORA. Es un
// dato del negocio, no solo del comprador.

import { db } from "@/lib/db";
import { hashPassword, passwordProblem, quemarTiempo, verifyPassword } from "./password";
import { normalizarTelefono } from "@/modules/customers/phone";

/** El mismo mensaje para todo fallo de acceso. No se personaliza jamás. */
export const MENSAJE_ACCESO = "Correo o contraseña incorrectos.";

/**
 * Lo que se responde tras un registro, exista o no la cuenta.
 *
 * Deliberadamente NO dice si se creó algo. Quien ya tiene cuenta lee lo mismo
 * que quien acaba de crearla, y el texto le dice qué hacer.
 */
export const MENSAJE_REGISTRO =
  "Listo. Si el correo no tenía cuenta, ya está creada; si ya la tenía, entra con tu contraseña.";

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
};

export type RegisterResult =
  | { ok: true; customerId: string | null }
  | { ok: false; error: string; field?: "password" | "email" | "name" };

/**
 * Crea la cuenta.
 *
 * Tres caminos, uno solo visible desde fuera:
 *   - Correo desconocido → cliente nuevo con contraseña.
 *   - Correo que YA es cliente (compró como invitado) → se le pone contraseña.
 *     Su historial y su cashback aparecen solos, que es el punto de que la
 *     credencial cuelgue del cliente y no de una tabla paralela.
 *   - Correo que ya tiene cuenta → no se toca nada, y la respuesta es igual.
 */
export async function registerBuyer(input: RegisterInput): Promise<RegisterResult> {
  const problema = passwordProblem(input.password);
  if (problema) return { ok: false, error: problema, field: "password" };

  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: "Escribe tu nombre completo.", field: "name" };

  const email = input.email.toLowerCase().trim();
  const existente = await db.customer.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, accountActive: true },
  });

  // Ya tenía cuenta: no se toca nada. Cambiar aquí la contraseña sería
  // permitir tomar la cuenta de otro sabiendo solo su correo.
  if (existente?.passwordHash) {
    await quemarTiempo(input.password);
    return { ok: true, customerId: null };
  }

  const passwordHash = await hashPassword(input.password);

  if (existente) {
    await db.customer.update({
      where: { id: existente.id },
      data: { passwordHash, accountCreated: new Date(), accountActive: true },
    });
    return { ok: true, customerId: existente.id };
  }

  // El teléfono se guarda en E.164, igual que lo hace el checkout. Antes se
  // guardaba tal cual lo escribió el comprador, así que el MISMO teléfono
  // quedaba como "3142751611" desde la cuenta y "+573142751611" desde un
  // pedido: dos filas para una persona, y el módulo de clientes las ve como
  // dos. Es dato de contacto, no identidad —esa es el correo—, así que si
  // choca con otro cliente se guarda vacío en vez de tumbar el registro:
  // `phone` es ÚNICO en la base y un choque aquí dejaría a alguien sin poder
  // crear su cuenta, por un dato que ni siquiera usa para entrar.
  const telefono = normalizarTelefono(input.phone);
  const libre = telefono
    ? !(await db.customer.findFirst({ where: { phone: telefono }, select: { id: true } }))
    : false;

  const creado = await db.customer.create({
    data: {
      name,
      email,
      phone: libre ? telefono : null,
      source: "WEB",
      passwordHash,
      accountCreated: new Date(),
    },
    select: { id: true },
  });
  return { ok: true, customerId: creado.id };
}

export type LoginResult = { ok: true; customerId: string } | { ok: false; error: string };

/**
 * Comprueba las credenciales.
 *
 * Cuenta inexistente, sin contraseña, desactivada o contraseña incorrecta dan
 * EL MISMO resultado. Cuando no hay contraseña que comparar se quema el tiempo
 * de una comparación real: sin eso, la diferencia de latencia delata quién es
 * cliente y los mensajes iguales no sirven de nada.
 */
export async function verifyBuyer(email: string, password: string): Promise<LoginResult> {
  const cliente = await db.customer.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, passwordHash: true, accountActive: true },
  });

  if (!cliente?.passwordHash || !cliente.accountActive) {
    await quemarTiempo(password);
    return { ok: false, error: MENSAJE_ACCESO };
  }

  const valida = await verifyPassword(password, cliente.passwordHash);
  if (!valida) return { ok: false, error: MENSAJE_ACCESO };

  return { ok: true, customerId: cliente.id };
}

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Cambia la contraseña conociendo la actual.
 *
 * Quien la llama debe cerrar después las demás sesiones: cambiar la contraseña
 * es lo que hace alguien que sospecha que otra persona entró, y si las sesiones
 * abiertas siguieran valiendo el gesto no serviría de nada.
 */
export async function changePassword(
  customerId: string,
  actual: string,
  nueva: string,
): Promise<ChangePasswordResult> {
  const problema = passwordProblem(nueva);
  if (problema) return { ok: false, error: problema };

  const cliente = await db.customer.findUnique({
    where: { id: customerId },
    select: { passwordHash: true },
  });
  if (!cliente?.passwordHash) return { ok: false, error: MENSAJE_ACCESO };

  const valida = await verifyPassword(actual, cliente.passwordHash);
  if (!valida) return { ok: false, error: "La contraseña actual no es correcta." };

  await db.customer.update({
    where: { id: customerId },
    data: { passwordHash: await hashPassword(nueva) },
  });
  return { ok: true };
}
