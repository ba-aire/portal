import type { IcaCategoria, IcaEstacion } from "@/lib/ica/models";
import { COLOR_SIN_DATO, franjaHoraria } from "@/lib/ica/presentacion";
import { Etiqueta } from "./etiqueta";

/**
 * Lo que se ve al tocar una estación en el mapa: lo que antes eran las
 * tarjetas debajo del índice de la Ciudad.
 */
export function DetalleEstacion({
  estacion,
  categorias,
  enHora,
}: {
  estacion: IcaEstacion;
  categorias: IcaCategoria[];
  /** true = se eligió una hora en el selector (no la última de cada estación). */
  enHora: boolean;
}) {
  const colorDe = (categoria: number) =>
    categorias.find((c) => c.categoria === categoria)?.color_hex ?? null;
  // El entorno que publica el GCBA ("Residencial-comercial"), no nuestra
  // clasificación en tránsito / industrial / fondo.
  const zona = estacion.station_zone;
  const franja = franjaHoraria(estacion.ts_hour);

  return (
    <div className="flex flex-col gap-2 text-sm text-gray-900">
      {/* pr-7: el nombre no se mete debajo del botón de cerrar. */}
      <div className="flex flex-col pr-7">
        <span className="text-base font-bold text-primary">
          {estacion.station_name}
        </span>
        {zona && <span className="text-xs text-gray-600">{zona}</span>}
      </div>

      {estacion.categoria === null ? (
        <span className="text-gray-600">
          {enHora ? "Sin índice a esa hora" : "Sin índice en las últimas horas"}
        </span>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta color={estacion.color_hex}>
              {estacion.categoria_nombre}
              {estacion.valor !== null && ` · ${estacion.valor}`}
            </Etiqueta>
            {franja && <span className="text-xs text-gray-600">{franja}</span>}
          </div>

          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {estacion.contaminantes.map((c) => (
              <li key={c.parameter_code} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="inline-block size-2.5 rounded-full border border-black/20"
                  style={{
                    backgroundColor: colorDe(c.categoria) ?? COLOR_SIN_DATO,
                  }}
                />
                <span>{c.nombre}</span>
                {c.subindice !== null && (
                  <span className="text-gray-600">{c.subindice}</span>
                )}
              </li>
            ))}
          </ul>

          {/* Una estación que mide menos contaminantes da un índice "mejor"
              solo por eso. data lo marca y acá se dice. */}
          {estacion.indice_completo === false && (
            <span className="text-xs text-amber-800">
              Índice incompleto: faltan contaminantes para este tipo de
              estación.
            </span>
          )}
        </>
      )}

      {/* La descripción oficial del sitio (planilla de estaciones del GCBA),
          no una clasificación nuestra. */}
      {estacion.station_description && (
        <span className="border-t pt-2 text-xs leading-snug text-gray-600">
          {estacion.station_description}
        </span>
      )}
    </div>
  );
}
