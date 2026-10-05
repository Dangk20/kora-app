import {
  Baby,
  BookOpen,
  CarFront,
  Coffee,
  createLucideIcon,
  Dumbbell,
  Gem,
  Flower2,
  Gift,
  Headphones,
  Lamp,
  Milk,
  Package,
  PawPrint,
  Shirt,
  Smartphone,
  Sparkles,
  ToyBrick,
  Watch,
  type LucideIcon,
} from "lucide-react";

// Lucide no trae vestido ni labial, que son justo dos líneas del catálogo
// (Mujer, Maquillaje). Se dibujan con su mismo trazo para que no desentonen.
const Dress = createLucideIcon("dress", [
  ["path", { d: "M9 2v3.5c.9.8 1.9 1.2 3 1.2s2.1-.4 3-1.2V2", key: "escote" }],
  ["path", { d: "M9 5.5 7.5 10l2.5 2-6 9h16l-6-9 2.5-2L15 5.5", key: "cuerpo" }],
  ["path", { d: "M10 12h4", key: "cintura" }],
]);
const Lipstick = createLucideIcon("lipstick", [
  ["rect", { x: "8", y: "13", width: "8", height: "9", rx: "1", key: "base" }],
  ["path", { d: "M9 13V9h6v4", key: "tubo" }],
  ["path", { d: "M10 9V5l4-3v7", key: "barra" }],
]);

// Set de íconos disponible para categorías (patrón del prototipo)
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  package: Package,
  smartphone: Smartphone,
  lamp: Lamp,
  sparkles: Sparkles,
  watch: Watch,
  shirt: Shirt,
  dumbbell: Dumbbell,
  headphones: Headphones,
  coffee: Coffee,
  gem: Gem,
  gift: Gift,
  book: BookOpen,
  baby: Baby,
  paw: PawPrint,
  // Añadidos el 4 oct 2026 para las líneas reales del catálogo.
  dress: Dress,
  lipstick: Lipstick,
  flower: Flower2,
  car: CarFront,
  milk: Milk,
  toy: ToyBrick,
};

// Paleta de tiles de categoría: pasteles derivados del gradiente oficial
// (naranja → coral → rosa → magenta → morado) más el beige del manual.
// El prototipo traía verdes y azules; se reemplazaron para no salirse de la
// línea gráfica. El orden recorre el gradiente, así que categorías contiguas
// se distinguen entre sí.
export const TILE_PALETTE: { bg: string; ink: string }[] = [
  { bg: "#FFE9DD", ink: "#D95A00" }, // naranja
  { bg: "#FFDECE", ink: "#C4551A" }, // coral
  { bg: "#FBDCE9", ink: "#D81B60" }, // rosa
  { bg: "#F9D5E4", ink: "#F2357E" }, // rosa marca
  { bg: "#F3DAF8", ink: "#C026D3" }, // magenta
  { bg: "#EFE6F7", ink: "#7A3DB8" }, // morado marca
  { bg: "#E7DEF5", ink: "#5E2E93" }, // morado profundo
  { bg: "#F9F3EE", ink: "#3C3C3C" }, // beige del manual
];

export function inkFor(bg: string): string {
  return TILE_PALETTE.find((p) => p.bg.toLowerCase() === bg.toLowerCase())?.ink ?? "#4a4f58";
}

/** Tile de producto/categoría: pastel + ícono (placeholder hasta tener fotos) */
export function CategoryTile({
  color,
  icon,
  size = 42,
  iconSize,
  radius = 10,
}: {
  color: string;
  icon: string;
  size?: number;
  iconSize?: number;
  radius?: number;
}) {
  const Icon = CATEGORY_ICONS[icon] ?? Package;
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        background: color,
        color: inkFor(color),
        borderRadius: radius,
      }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} size={iconSize} />
    </div>
  );
}
