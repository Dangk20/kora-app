import Image from "next/image";
import Link from "next/link";

// Placeholder hasta la Semana 5, cuando aquí vive la tienda.
export default function Home() {
  return (
    <main className="bg-kora-black relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden p-8">
      <div className="bg-kora-gradient pointer-events-none absolute -bottom-48 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl" />
      <Image
        src="/logo-kora.png"
        alt="KORA"
        width={280}
        height={73}
        priority
        className="relative h-16 w-auto"
      />
      <div className="relative text-center">
        <p className="text-lg text-white/80">Todo lo que quieres, en</p>
        <p className="font-accent text-4xl text-white">un solo lugar</p>
      </div>
      <p className="relative text-sm text-white/50">
        Nuestra tienda está en construcción.
      </p>
      <Link
        href="/login"
        className="relative text-xs text-white/30 underline-offset-4 hover:text-white/60 hover:underline"
      >
        Acceso al equipo
      </Link>
    </main>
  );
}
