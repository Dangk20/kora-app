"use client";

// Acciones del detalle: confirmar pago, avanzar estado, cancelar y reabrir.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, RotateCcw, X } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/client";
import {
  advanceOrderStatus,
  cancelOrder,
  confirmOrder,
  reopenOrder,
} from "@/modules/orders/actions";
import { CANCEL_REASONS, nextStatus, STATUS_LABEL } from "@/modules/orders/status";

export function OrderActions({
  orderId,
  status,
  canConfirm,
  canCancel,
  canEdit,
  hasShortages,
}: {
  orderId: string;
  status: OrderStatus;
  canConfirm: boolean;
  canCancel: boolean;
  canEdit: boolean;
  hasShortages: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.ok) {
        setCancelOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "No se pudo completar la acción");
      }
    });

  const next = nextStatus(status);
  const showConfirm = status === "PENDING" && canConfirm;
  const showAdvance = canEdit && next && status !== "PENDING" && status !== "CANCELLED";
  const showCancel =
    canCancel && (status === "PENDING" || status === "CONFIRMED");
  const showReopen = canEdit && status === "CANCELLED";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2.5">
        {showConfirm && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => confirmOrder(orderId))}
            title={
              hasShortages
                ? "Hay ítems sin stock suficiente; la confirmación va a fallar"
                : undefined
            }
            className="bg-kora-gradient flex items-center gap-2 rounded-[11px] px-[18px] py-2.5 text-[13.5px] font-bold text-white shadow-[0_6px_16px_rgba(255,90,31,.3)] hover:opacity-90 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Confirmar pago
          </button>
        )}

        {showAdvance && next && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => advanceOrderStatus(orderId, next))}
            className="flex items-center gap-2 rounded-[11px] bg-kora-black px-[18px] py-2.5 text-[13.5px] font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            Marcar como {STATUS_LABEL[next].toLowerCase()}
          </button>
        )}

        {showReopen && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reopenOrder(orderId))}
            className="flex items-center gap-2 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-kora-black hover:border-kora-coral disabled:opacity-60"
          >
            <RotateCcw className="size-4" /> Reabrir
          </button>
        )}

        {showCancel && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setCancelOpen((v) => !v)}
            className="flex items-center gap-2 rounded-[11px] border-[1.6px] border-[#e2ddd6] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-destructive hover:border-destructive disabled:opacity-60"
          >
            <X className="size-4" /> Cancelar
          </button>
        )}
      </div>

      {cancelOpen && (
        <div className="w-[320px] rounded-[14px] border border-[#f0ece6] bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
          <p className="mb-2 text-[13px] font-bold text-kora-black">
            Motivo de la cancelación
          </p>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mb-2 w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3 py-2.5 text-[13px] outline-none focus:border-kora-coral"
          >
            {CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {reason === "Otro" && (
            <input
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              placeholder="Describe el motivo"
              autoFocus
              className="mb-2 w-full rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3 py-2.5 text-[13px] outline-none focus:border-kora-coral"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className="flex-1 rounded-[10px] border-[1.6px] border-[#e2ddd6] py-2 text-[13px] font-semibold text-kora-black hover:bg-muted"
            >
              Volver
            </button>
            <button
              type="button"
              disabled={pending || (reason === "Otro" && otherReason.trim().length < 3)}
              onClick={() =>
                run(() =>
                  cancelOrder(orderId, reason === "Otro" ? otherReason : reason),
                )
              }
              className="flex-1 rounded-[10px] bg-destructive py-2 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              Cancelar pedido
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="flex max-w-[380px] items-start gap-1.5 text-right text-[12.5px] font-semibold text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
