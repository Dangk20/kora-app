"use client";

// Carrito del visitante (módulo CAR). Vive en el navegador: no hay cuenta
// obligatoria y no queremos una sesión de servidor por curioso que entra.
//
// Guarda SOLO identidad y cantidad (variantId + qty). Los precios NUNCA se
// guardan aquí: se resuelven en el servidor al pintar el carrito y otra vez al
// crear el pedido, así un carrito viejo no puede fijar un precio antiguo ni
// manipularse desde el navegador.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "kora_carrito";

export type CartLine = { variantId: string; qty: number };

type CartContextValue = {
  lines: CartLine[];
  /** Unidades totales, para el badge del header. */
  count: number;
  ready: boolean;
  add: (variantId: string, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  /** Panel lateral del carrito (mini-carrito del header). */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function read(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is CartLine =>
          typeof l === "object" &&
          l !== null &&
          typeof (l as CartLine).variantId === "string" &&
          Number.isInteger((l as CartLine).qty),
      )
      .filter((l) => l.qty > 0);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  // `ready` evita el parpadeo: en el primer render del servidor no hay
  // localStorage, así que el badge no debe pintar 0 y luego saltar.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(read());
    setReady(true);
  }, []);

  // Otra pestaña abierta con el mismo carrito se mantiene en sincronía.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLines(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Modo incógnito con storage bloqueado: el carrito vive solo en memoria.
    }
  }, []);

  const add = useCallback(
    (variantId: string, qty = 1) => {
      if (qty <= 0) return;
      const current = read();
      const existing = current.find((l) => l.variantId === variantId);
      persist(
        existing
          ? current.map((l) =>
              l.variantId === variantId ? { ...l, qty: l.qty + qty } : l,
            )
          : [...current, { variantId, qty }],
      );
    },
    [persist],
  );

  const setQty = useCallback(
    (variantId: string, qty: number) => {
      const current = read();
      persist(
        qty <= 0
          ? current.filter((l) => l.variantId !== variantId)
          : current.map((l) => (l.variantId === variantId ? { ...l, qty } : l)),
      );
    },
    [persist],
  );

  const remove = useCallback(
    (variantId: string) => persist(read().filter((l) => l.variantId !== variantId)),
    [persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Con el panel abierto no se debe poder desplazar la página de atrás.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onEscape);
    };
  }, [drawerOpen]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((sum, l) => sum + l.qty, 0),
      ready,
      add,
      setQty,
      remove,
      clear,
      drawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [lines, ready, add, setQty, remove, clear, drawerOpen, openDrawer, closeDrawer],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
