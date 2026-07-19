import Image from "next/image";
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

      {/* Panel de marca: gradiente oficial 135° con curva inferior izquierda */}
      <section className="bg-kora-gradient relative hidden overflow-hidden rounded-bl-[160px] lg:flex lg:w-[45%]">
        {/* Formas fluidas sobre el gradiente */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-1/4 -left-20 h-80 w-80 rounded-full bg-kora-purple/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/4 h-96 w-96 rounded-full bg-kora-black/30 blur-3xl" />

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
