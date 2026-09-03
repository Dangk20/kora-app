import { Download, Eye, FileText, Lock } from "lucide-react";
import {
  FACTURA_ELECTRONICA_ETIQUETA,
  FACTURA_ELECTRONICA_PENDIENTE,
  FACTURA_ELECTRONICA_PRONTO,
} from "@/modules/invoicing/lock";

/**
 * Los documentos de un pedido confirmado.
 *
 * Los DOS aparecen, y la factura electrónica desactivada con el motivo a la
 * vista. Es el criterio de Email marketing: un botón ausente se lee como
 * funcionalidad no contemplada; uno desactivado que dice qué falta le señala al
 * cliente cuál es su parte — y aquí los tres insumos son suyos.
 */
export function DocumentosDelPedido({ orderId }: { orderId: string }) {
  const base = `/admin/pedidos/${orderId}/comprobante`;

  return (
    <section className="rounded-[18px] bg-white p-6 shadow-[0_3px_14px_rgba(0,0,0,0.04)]">
      <h2 className="mb-4 text-[15px] font-bold text-kora-black">Documentos</h2>

      <div className="flex items-center gap-3 rounded-[12px] border border-[#efeae4] p-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#FFE9DD] text-kora-coral">
          <FileText className="size-[17px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-kora-black">Comprobante de pedido</p>
          <p className="text-[11.5px] text-[#9aa0ab]">Emitido al confirmar el pedido</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={base}
            target="_blank"
            rel="noreferrer"
            aria-label="Ver el comprobante"
            title="Ver"
            className="flex size-8 items-center justify-center rounded-lg text-[#b3b8c0] transition-colors hover:bg-[#FFE9DD] hover:text-kora-coral"
          >
            <Eye className="size-[15px]" />
          </a>
          <a
            href={`${base}?descargar`}
            aria-label="Descargar el comprobante"
            title="Descargar"
            className="flex size-8 items-center justify-center rounded-lg text-[#b3b8c0] transition-colors hover:bg-[#FFE9DD] hover:text-kora-coral"
          >
            <Download className="size-[15px]" />
          </a>
        </div>
      </div>

      <div className="mt-3 rounded-[12px] border border-dashed border-[#e2ddd6] bg-[#faf8f5] p-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#efeae4] text-[#9aa0ab]">
            <Lock className="size-[16px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-[#6b6f78]">
              {FACTURA_ELECTRONICA_ETIQUETA}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#efeae4] px-2.5 py-1 text-[10.5px] font-bold tracking-wide text-[#6b6f78] uppercase">
            {FACTURA_ELECTRONICA_PRONTO}
          </span>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-[#9aa0ab]">
          {FACTURA_ELECTRONICA_PENDIENTE}
        </p>
      </div>
    </section>
  );
}
