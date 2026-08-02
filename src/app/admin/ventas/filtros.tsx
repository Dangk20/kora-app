// Filtros del módulo de ventas.
//
// Van en la DIRECCIÓN, como el resto del panel: así el operador puede guardar
// el enlace de "mis ventas de julio", compartirlo y recargar sin perderlo. Un
// formulario normal (GET) basta — sin estado en cliente que mantener.

export type FiltrosValores = {
  desde: string;
  hasta: string;
  canal: string;
  moneda: string;
};

const campo =
  "rounded-[10px] border-[1.6px] border-[#e2ddd6] px-3 py-2.5 text-sm outline-none focus:border-kora-coral";

export function Filtros({ valores }: { valores: FiltrosValores }) {
  return (
    <form
      action="/admin/ventas"
      className="mb-5 flex flex-wrap items-end gap-3 rounded-[14px] border border-[#eee9e2] bg-white p-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[#6b6f78]">Desde</span>
        <input type="date" name="desde" defaultValue={valores.desde} className={campo} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[#6b6f78]">Hasta</span>
        <input type="date" name="hasta" defaultValue={valores.hasta} className={campo} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[#6b6f78]">Canal</span>
        <select name="canal" defaultValue={valores.canal} className={campo}>
          <option value="">Todos</option>
          <option value="WEB">Online</option>
          <option value="POS">Punto de venta</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[#6b6f78]">Moneda</span>
        <select name="moneda" defaultValue={valores.moneda} className={campo}>
          {/* "Ambas" no combina nada: muestra los totales de cada una por
              separado. Las monedas no se suman. */}
          <option value="">Ambas, por separado</option>
          <option value="COP">COP</option>
          <option value="USD">USD</option>
        </select>
      </label>

      <button
        type="submit"
        className="bg-kora-gradient rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white"
      >
        Filtrar
      </button>
    </form>
  );
}
