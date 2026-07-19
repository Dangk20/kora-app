"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type ActionResult,
} from "@/modules/catalog/category-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  productCount: number;
};

function FormError({ state }: { state: ActionResult }) {
  if (!state || state.ok) return null;
  return <p className="text-sm text-destructive">{state.error}</p>;
}

function CreateCategoryDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCategory, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand">
          <Plus className="size-4" /> Nueva categoría
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva categoría</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cat-name">Nombre</Label>
            <Input id="cat-name" name="name" required autoFocus />
          </div>
          <FormError state={state} />
          <Button type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear categoría"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({ category }: { category: CategoryRow }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateCategory, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Editar ${category.name}`}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar categoría</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={category.id} />
          <div className="grid gap-2">
            <Label htmlFor={`cat-name-${category.id}`}>Nombre</Label>
            <Input
              id={`cat-name-${category.id}`}
              name="name"
              defaultValue={category.name}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`cat-active-${category.id}`}
              name="active"
              defaultChecked={category.active}
            />
            <Label htmlFor={`cat-active-${category.id}`}>Visible en la tienda</Label>
          </div>
          <FormError state={state} />
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryButton({ category }: { category: CategoryRow }) {
  const [state, formAction, pending] = useActionState(deleteCategory, null);
  const blocked = category.productCount > 0;

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={category.id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={pending || blocked}
        title={
          blocked
            ? "Tiene productos: reasígnalos antes de eliminar"
            : "Eliminar categoría"
        }
        aria-label={`Eliminar ${category.name}`}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
      {state && !state.ok && (
        <span className="text-xs text-destructive">{state.error}</span>
      )}
    </form>
  );
}

export function CategoriesTable({
  categories,
  canCreate,
  canEdit,
  canDelete,
}: {
  categories: CategoryRow[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <CreateCategoryDialog />
        </div>
      )}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Productos</TableHead>
              <TableHead>Estado</TableHead>
              {(canEdit || canDelete) && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                <TableCell className="text-right">{c.productCount}</TableCell>
                <TableCell>
                  {c.active ? (
                    <Badge>Visible</Badge>
                  ) : (
                    <Badge variant="outline">Oculta</Badge>
                  )}
                </TableCell>
                {(canEdit || canDelete) && (
                  <TableCell>
                    <div className="flex items-center">
                      {canEdit && <EditCategoryDialog category={c} />}
                      {canDelete && <DeleteCategoryButton category={c} />}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Aún no hay categorías.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
