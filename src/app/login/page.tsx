import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { LoginForm } from "./login-form";

async function authenticate(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=credenciales");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen bg-white">
      {/* Columna del formulario */}
      <section className="flex flex-1 flex-col px-8 py-6 lg:px-16">
        {/* Salida a la tienda. Sin ella, quien entra aquí por error —o el
            operador que termina su turno— se queda encerrado: el login no
            forma parte de ningún chrome, así que no hereda ni el header de la
            tienda ni el del panel, y la única vía era editar la barra de
            direcciones. */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 self-start text-[13px] text-muted-foreground transition-colors hover:text-kora-black"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a la tienda
        </Link>

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm lg:mx-0">
            <h1 className="text-4xl font-extrabold tracking-tight">
              Iniciar sesión
            </h1>
            <p className="mt-2 mb-8 text-sm text-muted-foreground">
              Ingresa tu correo y contraseña para entrar al panel
            </p>
            <LoginForm action={authenticate} error={error} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          © 2026 KORA. Todos los derechos reservados.
        </p>
      </section>

      {/* Panel de marca: NEGRO FIJO, con el degradado desarrollándose desde la
          esquina inferior derecha.

          Antes el panel era el gradiente entero, y sobre su tramo naranja el
          logotipo —que es blanco— se desvanecía en su propio fondo. Con la
          base negra el logo tiene el contraste máximo, y la marca no se
          pierde: el degradado sigue siendo el oficial del manual, con sus
          cinco paradas y en su mismo orden, solo que naciendo de una esquina
          y disolviéndose en el negro en vez de rellenar el panel. */}
      <section className="relative hidden overflow-hidden rounded-bl-[160px] bg-kora-black lg:flex lg:w-[45%]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            // Radial anclado en la esquina (100% 100%): las paradas son las
            // mismas del gradiente de marca —#ff6a00 → #7a3db8— y la última
            // es transparente, que es lo que lo funde con el negro sin borde.
            backgroundImage:
              "radial-gradient(105% 68% at 100% 100%, #ff6a00 0%, #ff5a1f 16%, #f2357e 34%, #c026d3 52%, #7a3db8 70%, rgba(122,61,184,0) 100%)",
          }}
        />

        <div className="relative z-10 flex w-full flex-col items-center justify-center gap-10 p-12">
          <Image
            src="/logo-kora.png"
            alt="KORA"
            width={320}
            height={83}
            priority
            className="h-20 w-auto drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
          />
          <div className="rounded-2xl border border-white/30 bg-white/10 px-10 py-5 text-center backdrop-blur-sm">
            <p className="text-sm text-white/85">Todo lo que quieres, en</p>
            <p className="font-accent text-3xl text-white">un solo lugar</p>
          </div>
        </div>
      </section>
    </main>
  );
}
