"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { createUser, updateUser, type ActionResult } from "@/modules/auth/actions";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserRow = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  active: boolean;
  createdAt: string;
};

type RoleOption = { id: string; name: string };

function RoleSelect({ roles, defaultValue }: { roles: RoleOption[]; defaultValue?: string }) {
  return (
    <div className="grid gap-2">
      <Label>Rol</Label>
      <Select name="roleId" defaultValue={defaultValue}>
        <SelectTrigger>
          <SelectValue placeholder="Selecciona un rol" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FormError({ state }: { state: ActionResult }) {
  if (!state || state.ok) return null;
  return <p className="text-sm text-destructive">{state.error}</p>;
}

function CreateUserDialog({ roles }: { roles: RoleOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUser, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="new-name">Nombre</Label>
            <Input id="new-name" name="name" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-email">Correo</Label>
            <Input id="new-email" name="email" type="email" required />
          </div>
          <RoleSelect roles={roles} />
          <div className="grid gap-2">
            <Label htmlFor="new-password">Contraseña inicial</Label>
            <Input id="new-password" name="password" type="password" required minLength={8} />
          </div>
          <FormError state={state} />
          <Button type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear usuario"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  roles,
  isSelf,
}: {
  user: UserRow;
  roles: RoleOption[];
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateUser, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Editar ${user.name}`}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={user.id} />
          <div className="grid gap-2">
            <Label>Correo</Label>
            <Input value={user.email} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`name-${user.id}`}>Nombre</Label>
            <Input id={`name-${user.id}`} name="name" defaultValue={user.name} required />
          </div>
          <RoleSelect roles={roles} defaultValue={user.roleId} />
          <div className="grid gap-2">
            <Label htmlFor={`password-${user.id}`}>Nueva contraseña (opcional)</Label>
            <Input
              id={`password-${user.id}`}
              name="password"
              type="password"
              placeholder="Dejar vacía para no cambiarla"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Deshabilitado no se envía: al editarse a sí mismo, activo va fijo en on */}
            {isSelf && <input type="hidden" name="active" value="on" />}
            <Checkbox
              id={`active-${user.id}`}
              name={isSelf ? undefined : "active"}
              defaultChecked={user.active}
              disabled={isSelf}
            />
            <Label htmlFor={`active-${user.id}`}>Usuario activo</Label>
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

export function UsersTable({
  users,
  roles,
  currentUserId,
  canCreate,
  canEdit,
}: {
  users: UserRow[];
  roles: RoleOption[];
  currentUserId: string;
  canCreate: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <CreateUserDialog roles={roles} />
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              {canEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
                  )}
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{u.roleName}</Badge>
                </TableCell>
                <TableCell>
                  {u.active ? (
                    <Badge>Activo</Badge>
                  ) : (
                    <Badge variant="outline">Inactivo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{u.createdAt}</TableCell>
                {canEdit && (
                  <TableCell>
                    <EditUserDialog
                      user={u}
                      roles={roles}
                      isSelf={u.id === currentUserId}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
