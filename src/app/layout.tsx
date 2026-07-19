import type { Metadata } from "next";
import { Allura, Manrope } from "next/font/google";
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
