import type { IcaCategoria, Indice } from "@/lib/ica/models";
import { COLOR_SIN_DATO, TRAMOS_AQI } from "@/lib/ica/presentacion";
import { cn } from "@/lib/utils";

function Muestra({
  color,
  punteada = false,
}: {
  color: string;
  punteada?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 shrink-0 rounded-sm",
        punteada ? "border-2 border-dashed border-gray-500" : "",
      )}
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * La escala de colores, flotando sobre el mapa como en el visor de la EEA.
 * Las categorías, sus nombres y sus colores salen de airedb (indice.v_categoria).
 */
export function Leyenda({
  indice,
  categorias,
  className,
}: {
  indice: Indice;
  categorias: IcaCategoria[];
  className?: string;
}) {
  return (
    <section
      aria-label="Escala del índice"
      className={cn(
        "rounded-lg border border-primary/15 bg-white/95 p-3 text-gray-900 shadow-md shadow-black/15",
        className,
      )}
    >
      <ul className="flex flex-col gap-1.5 text-xs sm:text-sm">
        {categorias.map((c) => (
          <li key={c.categoria} className="flex items-center gap-2">
            <Muestra color={c.color_hex ?? COLOR_SIN_DATO} />
            <span className="flex-1">{c.nombre}</span>
            {indice === "EPA" && TRAMOS_AQI[c.categoria] && (
              <span className="pl-2 tabular-nums text-gray-600">
                {TRAMOS_AQI[c.categoria]}
              </span>
            )}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <Muestra color={COLOR_SIN_DATO} />
          <span>Sin dato</span>
        </li>
      </ul>
      {/* Explica el borde punteado de los marcadores, que de otro modo no se
          entiende. */}
      <p className="mt-2 flex items-center gap-2 border-t border-primary/10 pt-2 text-xs text-gray-600">
        <span
          aria-hidden
          className="inline-block size-3.5 shrink-0 rounded-full border-2 border-dashed border-gray-500"
        />
        Índice incompleto
      </p>
    </section>
  );
}
