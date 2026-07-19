export const formatCop = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

export const formatUsd = (n: number) =>
  `US$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
