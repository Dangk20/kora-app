import {
  Baby,
  BookOpen,
  Coffee,
  Dumbbell,
  Gem,
  Gift,
  Headphones,
  Lamp,
  Package,
  PawPrint,
  Shirt,
  Smartphone,
  Sparkles,
  Watch,
  type LucideIcon,
} from "lucide-react";

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
};

// Paleta de tiles del prototipo: fondo pastel → tinta
export const TILE_PALETTE: { bg: string; ink: string }[] = [
  { bg: "#FBE3D3", ink: "#b5571e" },
  { bg: "#FBEFD6", ink: "#a87a1e" },
  { bg: "#F8D7DD", ink: "#c0506a" },
  { bg: "#ECE0F5", ink: "#8a5cb0" },
  { bg: "#D9EFE6", ink: "#2f9c72" },
  { bg: "#DDEBFB", ink: "#2a6fdb" },
  { bg: "#FCE4EC", ink: "#c2185b" },
  { bg: "#E6F0D9", ink: "#5a7d2a" },
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
