"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { upsertProduct } from "@/modules/catalog/product-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type VariantDraft = {
  id?: string;
  sku: string;
  name: string;
  barcode: string;
  priceCopStore: string;
  priceCopOnline: string;
  priceUsdStore: string;
  priceUsdOnline: string;
  stockMin: string;
  initialStock: string;
  active: boolean;
  stockActual?: number; // solo informativo en edición
};

export type ProductDraft = {
  id?: string;
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  active: boolean;
  featured: boolean;
  variants: VariantDraft[];
};

const emptyVariant = (): VariantDraft => ({
  sku: "",
  name: "",
  barcode: "",
  priceCopStore: "",
  priceCopOnline: "",
  priceUsdStore: "",
  priceUsdOnline: "",
  stockMin: "0",
  initialStock: "0",
  active: true,
});

export function ProductForm({
  categories,
  initial,
}: {
  categories: { id: string; name: string }[];
  initial?: ProductDraft;
}) {
  const [state, formAction, pending] = useActionState(upsertProduct, null);
  const [product, setProduct] = useState<ProductDraft>(
    initial ?? {
      name: "",
      brand: "",
      categoryId: "",
      description: "",
      active: true,
      featured: false,
      variants: [emptyVariant()],
    },
  );

  const setField = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setProduct((p) => ({ ...p, [key]: value }));

  const setVariant = (index: number, patch: Partial<VariantDraft>) =>
    setProduct((p) => ({
      ...p,
      variants: p.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));

  const removeVariant = (index: number) =>
    setProduct((p) => ({
      ...p,
      variants: p.variants.filter((_, i) => i !== index),
    }));

  const payload = JSON.stringify({
    ...product,
    variants: product.variants.map((v) => ({
      ...v,
      stockActual: undefined,
    })),
  });

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />
      {product.id && <input type="hidden" name="id" value={product.id} />}

      <Card>
        <CardHeader>
          <CardTitle>Información del producto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="p-name">Nombre</Label>
            <Input
              id="p-name"
              value={product.name}
              onChange={(e) => setField("name", e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-brand">Marca (opcional)</Label>
            <Input
              id="p-brand"
              value={product.brand}
              onChange={(e) => setField("brand", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Categoría</Label>
            <Select
              value={product.categoryId}
              onValueChange={(v) => setField("categoryId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-desc">Descripción (opcional)</Label>
            <Input
              id="p-desc"
              value={product.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={product.active}
                onCheckedChange={(v) => setField("active", v === true)}
              />
              Activo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={product.featured}
                onCheckedChange={(v) => setField("featured", v === true)}
              />
              Destacado en la tienda
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Variantes, SKU y precios</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() =>
              setProduct((p) => ({ ...p, variants: [...p.variants, emptyVariant()] }))
            }
          >
            <Plus className="size-4" /> Agregar variante
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {product.variants.map((v, i) => (
            <div key={v.id ?? `new-${i}`} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  Variante {i + 1}
                  {v.id && (
                    <span className="ml-3 font-normal text-muted-foreground">
                      Stock actual: {v.stockActual ?? 0} (se ajusta desde Inventario)
                    </span>
                  )}
                </p>
                {product.variants.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeVariant(i)}
                    aria-label={`Quitar variante ${i + 1}`}
                    title={
                      v.id
                        ? "Se desactivará (el historial de ventas se conserva)"
                        : "Quitar variante"
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>Nombre (ej. Talla M / Rojo)</Label>
                  <Input
                    value={v.name}
                    onChange={(e) => setVariant(i, { name: e.target.value })}
                    placeholder="Única"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>SKU</Label>
                  <Input
                    value={v.sku}
                    onChange={(e) => setVariant(i, { sku: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Código de barras (opcional)</Label>
                  <Input
                    value={v.barcode}
                    onChange={(e) => setVariant(i, { barcode: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="grid gap-1.5">
                  <Label>COP tienda</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={v.priceCopStore}
                    onChange={(e) => setVariant(i, { priceCopStore: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>COP online</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={v.priceCopOnline}
                    onChange={(e) => setVariant(i, { priceCopOnline: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>USD tienda</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={v.priceUsdStore}
                    onChange={(e) => setVariant(i, { priceUsdStore: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>USD online</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={v.priceUsdOnline}
                    onChange={(e) => setVariant(i, { priceUsdOnline: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {!v.id && (
                  <div className="grid gap-1.5">
                    <Label>Stock inicial</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={v.initialStock}
                      onChange={(e) => setVariant(i, { initialStock: e.target.value })}
                    />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label>Alerta de stock bajo</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={v.stockMin}
                    onChange={(e) => setVariant(i, { stockMin: e.target.value })}
                  />
                </div>
                {v.id && (
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <Checkbox
                      checked={v.active}
                      onCheckedChange={(val) => setVariant(i, { active: val === true })}
                    />
                    Variante activa
                  </label>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" variant="brand" size="lg" disabled={pending}>
          {pending ? "Guardando…" : product.id ? "Guardar cambios" : "Crear producto"}
        </Button>
        <Button variant="outline" size="lg" className="rounded-full" asChild>
          <Link href="/admin/catalogo">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
