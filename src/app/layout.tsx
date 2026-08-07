import type { Metadata } from "next";
import { Allura, Manrope } from "next/font/google";
import { storeUrl } from "@/lib/site";
import "./globals.css";

// Línea gráfica oficial KORA: Manrope (cuerpo y títulos hasta tener la
// fuente "KORA Custom"), Allura para acentos manuscritos.
const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const allura = Allura({
  variable: "--font-accent",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Base para resolver URL relativas de metadata (imágenes de Open Graph,
  // canonical). Sin ella Next avisa en cada build y las vistas previas se
  // comparten con rutas relativas, que ningún cliente de chat sabe resolver.
  metadataBase: new URL(storeUrl()),
  title: {
    default: "KORA",
    template: "%s · KORA",
  },
  description: "Tienda online KORA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${manrope.variable} ${allura.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
