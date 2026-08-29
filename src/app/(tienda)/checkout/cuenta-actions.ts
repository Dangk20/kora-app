"use server";

// Crear la cuenta al terminar la compra, con los datos que ya dio.
//
// Solo se le pide la contraseña. El nombre, el correo y el teléfono ya están
// en el pedido que acaba de crear: volver a pedírselos sería tratarlo como si
// no acabara de escribirlos.
//
// Se parte del PEDIDO y no de un formulario con el correo dentro. Si el correo
// viajara desde el navegador, cualquiera podría mandar el suyo y quedarse con
// una cuenta a nombre de otra dirección; leyéndolo del pedido, la cuenta solo
// puede salir del correo que de verdad se usó para comprar.

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { MENSAJE_ACCESO, registerBuyer, verifyBuyer } from "@/modules/buyer/account";
import { comprobarLimite, limpiarIntentos, registrarFallo } from "@/modules/buyer/rate-limit";
import { passwordProblem } from "@/modules/buyer/password";
import { startBuyerSession } from "@/modules/buyer/session-cookie";
import { sendWelcomeEmail } from "@/modules/buyer/welcome-email";

export type CrearCuentaResult = { ok: true } | { ok: false; error: string };

export async function crearCuentaDelPedido(
  checkoutToken: string,
  password: string,
  password2: string,
): Promise<CrearCuentaResult> {
  if (password !== password2) {
    return { ok: false, error: "Las dos contraseñas no coinciden." };
  }
  const problema = passwordProblem(password);
  if (problema) return { ok: false, error: problema };

  // El token del checkout identifica el pedido que ESTA sesión acaba de crear.
  const pedido = await db.order.findUnique({
    where: { checkoutToken },
    select: { contactEmail: true, contactName: true, contactPhone: true },
  });

  if (!pedido?.contactEmail) {
    return { ok: false, error: "No encontramos tu pedido. Vuelve a intentarlo desde tu cuenta." };
  }

  const r = await registerBuyer({
    name: pedido.contactName ?? "Cliente",
    email: pedido.contactEmail,
    password,
    phone: pedido.contactPhone,
  });
  if (!r.ok) return { ok: false, error: r.error };

  // `customerId` es null cuando el correo YA tenía cuenta y no se tocó nada.
  // Aquí no debería pasar —solo se ofrece a quien no la tiene— pero puede: dos
  // pestañas, o alguien que se registró entre el pedido y este clic. En ese
  // caso no se inicia sesión ni se manda bienvenida: no sabemos si la
  // contraseña que acaba de escribir es la de esa cuenta.
  if (!r.customerId) {
    return {
      ok: false,
      error: "Ese correo ya tiene una cuenta. Entra con tu contraseña desde «Mi cuenta».",
    };
  }

  await sendWelcomeEmail(pedido.contactEmail, pedido.contactName).catch(() => false);

  const h = await headers();
  await startBuyerSession(r.customerId, h.get("user-agent") ?? undefined);

  return { ok: true };
}


/**
 * Entrar con la cuenta que ese correo YA tiene, al terminar la compra.
 *
 * El correo sale del PEDIDO, no del formulario: quien acaba de comprar solo
 * puede entrar con la dirección que usó para comprar. Si viajara desde el
 * navegador, esto sería una pantalla de acceso más — y sin límite de intentos.
 *
 * ⚠️ El pedido YA está atado a ese cliente antes de esto (`resolveOrderCustomer`
 * lo enlaza por correo dentro de la transacción de la compra). Entrar aquí sirve
 * para VERLO ahora, no para que le pertenezca: si dice "en otro momento", el
 * pedido aparecerá igual la próxima vez que entre.
 */
export async function entrarDesdePedido(
  checkoutToken: string,
  password: string,
): Promise<CrearCuentaResult> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocido";
  const limite = comprobarLimite(ip);
  if (!limite.permitido) {
    const min = Math.ceil(limite.esperaSegundos / 60);
    return { ok: false, error: `Demasiados intentos. Espera ${min} minuto(s).` };
  }

  const pedido = await db.order.findUnique({
    where: { checkoutToken },
    select: { contactEmail: true },
  });
  if (!pedido?.contactEmail) {
    return { ok: false, error: "No encontramos tu pedido." };
  }

  const login = await verifyBuyer(pedido.contactEmail, password);
  if (!login.ok) {
    registrarFallo(ip);
    // El mismo mensaje del acceso normal: no se dice si falló el correo o la
    // contraseña, aunque aquí el correo lo sepamos.
    return { ok: false, error: MENSAJE_ACCESO };
  }

  limpiarIntentos(ip);
  const h = await headers();
  await startBuyerSession(login.customerId, h.get("user-agent") ?? undefined);
  return { ok: true };
}
