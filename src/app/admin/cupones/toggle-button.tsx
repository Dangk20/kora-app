"use client";

// Pausar o reactivar en un clic desde el listado (CUP_HU003 §2).
// Es la ÚNICA forma de sacar un cupón de circulación: no existe eliminar.

import { useActionState, useEffect } from "react";
import { ACTION_ICON } from "../_components/action-icon";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { toggleCoupon, type CouponActionResult } from "@/modules/coupons/actions";

export function ToggleButton({
  id,
  active,
  code,
}: {
  id: string;
  active: boolean;
  code: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<CouponActionResult | null, FormData>(
    async (_p, fd) => toggleCoupon(fd),
    null,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-label={active ? `Pausar ${code}` : `Activar ${code}`}
        title={active ? "Pausar: el checkout dejará de aceptarlo" : "Activar"}
        className={`${ACTION_ICON} disabled:opacity-50`}
      >
        {active ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
    </form>
  );
}
