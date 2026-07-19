import Image from "next/image";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-kora-black p-4">
      {/* Resplandor del gradiente de marca sobre el negro oficial */}
      <div className="bg-kora-gradient pointer-events-none absolute -top-40 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl" />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-8">
        <Image
          src="/logo-kora.png"
          alt="KORA"
          width={220}
          height={57}
          priority
          className="h-14 w-auto"
        />
        <Card className="w-full border-white/10 bg-white">
          <CardHeader>
            <CardTitle className="text-xl">Bienvenido</CardTitle>
            <CardDescription>
              Ingresa a tu panel de administración
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={authenticate} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">
                  Correo o contraseña incorrectos.
                </p>
              )}
              <Button type="submit" variant="brand" size="lg" className="w-full">
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
