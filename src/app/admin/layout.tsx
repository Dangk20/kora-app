import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./nav-links";

async function logout() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      {/* Sidebar sobre negro oficial: la combinación de mayor contraste del manual */}
      <aside className="flex w-64 flex-col bg-kora-black p-4 text-white">
        <div className="px-2 py-1">
          {/* Logo oficial (fondo transparente, wordmark blanco): para superficies oscuras */}
          <Image
            src="/logo-kora.png"
            alt="KORA"
            width={140}
            height={36}
            priority
            className="h-9 w-auto"
          />
          <p className="mt-1 px-1 text-xs text-white/50">Panel administrativo</p>
        </div>
        <div className="my-4 h-px bg-white/10" />
        <NavLinks permissions={session.user.permissions ?? []} />
        <div className="my-4 h-px bg-white/10" />
        <div className="space-y-2 px-2">
          <p className="truncate text-sm">{session.user.name}</p>
          <Badge className="bg-kora-gradient border-0 text-white">
            {session.user.role}
          </Badge>
          <form action={logout}>
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              className="w-full rounded-full border border-white/20 text-white hover:bg-white/10 hover:text-white"
            >
              Salir
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 bg-kora-beige/60 p-8">{children}</main>
    </div>
  );
}
