// La llama de KORA como ícono vectorial (no emoji): escala sin perder nitidez
// y usa el gradiente oficial de marca. Sustituye al 🔥 y al ícono genérico de
// lucide en los títulos y destacados de la tienda.

export function KoraFlame({
  className,
  /** `gradient` para fondos claros; `solid` cuando ya va sobre color. */
  variant = "gradient",
  title,
}: {
  className?: string;
  variant?: "gradient" | "solid" | "white";
  title?: string;
}) {
  // Un id único por instancia: dos gradientes con el mismo id se pisan.
  const gradientId = `kora-flame-${variant}`;

  const fill =
    variant === "gradient"
      ? `url(#${gradientId})`
      : variant === "white"
        ? "#FFFFFF"
        : "currentColor";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {variant === "gradient" && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="24" x2="24" y2="0">
            <stop offset="0%" stopColor="#FF6A00" />
            <stop offset="35%" stopColor="#FF5A1F" />
            <stop offset="65%" stopColor="#F2357E" />
            <stop offset="100%" stopColor="#C026D3" />
          </linearGradient>
        </defs>
      )}
      {/* Cuerpo de la llama */}
      <path
        d="M13.4 1.6c.3 2.5-.6 4.3-2 5.9-1.6 1.8-3.7 3.2-4.9 5.5-1.9 3.6-.4 8 3.3 9.5 3.9 1.6 8.5-.2 10-4.1 1.1-2.8.4-5.6-1.2-7.9-.3 1-.9 1.8-1.8 2.2.6-3.9-.7-7.4-3.4-11.1z"
        fill={fill}
      />
      {/* Corazón de la llama, en hueco */}
      <path
        d="M11.6 13.2c1.3 1.1 1.9 2.4 1.6 3.9-.2 1.1-1.1 1.9-2.2 1.8-1.2-.1-2-1.1-1.9-2.4.1-1.3.9-2.4 2.5-3.3z"
        fill="#FFFFFF"
        fillOpacity={variant === "white" ? 0.35 : 0.9}
      />
    </svg>
  );
}
