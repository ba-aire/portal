import { ordenarSeries, SUFIJO_CARGADA, seriesDe } from "@/lib/datos/series";
import { encabezadoPeriodo, formatPeriodo, type Periodo } from "@/lib/periodo";

interface TableProps {
  data: Record<string, string | number | null>[];
  /** Período de cada fila: define el rótulo de la columna de tiempo. */
  interval: Periodo;
}

export default function Table({ data, interval }: TableProps) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="overflow-x-auto p-2">
        <span className="text-gray-500">No hay datos para mostrar</span>
      </div>
    );
  }

  // Recorro todas las filas para cubrir casos con merge (p.ej. pm10 + pm25)
  // donde data[0] puede no contener todas las columnas.
  const locations = ordenarSeries(seriesDe(data));

  // Horas que vienen de una carga manual y no de lo medido en linea.
  const hayCargadas = data.some((row) =>
    Object.keys(row).some((k) => k.endsWith(SUFIJO_CARGADA) && row[k]),
  );

  const displayName = (location: string) => {
    let label = location;
    if (label === "catalinas" || label.startsWith("catalinas ")) {
      label = label.replace(/^catalinas/, "La Boca");
    } else {
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    return label.replace(/\bPM25\b/, "PM2.5");
  };

  return (
    <div className="overflow-x-auto p-2">
      {hayCargadas && (
        <p className="mb-2 text-xs text-muted-foreground">
          <span className="mr-1 inline-block h-3 w-3 rounded-sm border border-sky-300 bg-sky-100 align-middle" />
          Hora cargada a mano: un promedio ya validado que no viene de lo medido
          en línea (ver Carga de datos).
        </p>
      )}
      <table className="min-w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">{encabezadoPeriodo(interval)}</th>
            {locations.map((location) => (
              <th key={location} className="border px-2 py-1 capitalize">
                {displayName(location)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            return (
              <tr key={String(row.time)}>
                <td className="border px-2 py-1 text-center whitespace-nowrap">
                  {formatPeriodo(String(row.time), interval)}
                </td>
                {locations.map((location) => {
                  const cargada = Boolean(row[`${location}${SUFIJO_CARGADA}`]);
                  return (
                    <td
                      key={location}
                      className={`border px-2 py-1 text-center${cargada ? " bg-sky-100" : ""}`}
                      title={cargada ? "Hora cargada a mano" : undefined}
                    >
                      {row[location] !== null && row[location] !== undefined
                        ? Number(row[location]).toFixed(3)
                        : "s/d"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
