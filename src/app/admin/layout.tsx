import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Store } from "lucide-react";
import { auth, signOut } from "@/auth";
import { NavLinks } from "./nav-links";
import { Topbar } from "./topbar";

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
  const permissions = session.user.permissions ?? [];

  return (
    <div className="bg-kora-beige flex min-h-screen">
      {/* Sidebar del prototipo (236px, oscura, sticky) con el negro oficial */}
      <aside className="bg-kora-black sticky top-0 flex h-screen w-[236px] shrink-0 flex-col px-4 py-6">
        <div className="mb-2 flex items-center gap-2.5 border-b border-white/10 px-2 pb-6">
          <Image
            src="/logo-kora.png"
            alt="KORA"
            width={110}
            height={29}
            priority
            className="h-7 w-auto"
          />
          <span className="text-[10px] tracking-[1px] text-white/40">ADMIN</span>
        </div>
        <NavLinks permissions={permissions} />
        <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-[10px] bg-white/5 px-3 py-2.5 text-[13px] font-semibold text-[#A0A4AD] hover:text-white"
          >
            <Store className="size-[17px]" strokeWidth={1.8} /> Ver tienda
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold text-white/40 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-[17px]" strokeWidth={1.8} /> Cerrar sesión
            </button>
          </form>
          <div className="px-3 pt-1">
            <p className="truncate text-xs text-white/60">{session.user.name}</p>
            <p className="text-[10px] tracking-wide text-white/35 uppercase">
              {session.user.role}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={session.user.name ?? "KORA"} permissions={permissions} />
        <main className="flex-1 px-8 pt-7 pb-14">{children}</main>
      </div>
    </div>
  );
}
