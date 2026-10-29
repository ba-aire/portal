interface TableProps {
  data: Record<string, string | number>[];
}

export default function Table({ data }: TableProps) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="overflow-x-auto p-2">
        <span className="text-gray-500">No hay datos para mostrar</span>
      </div>
    );
  }

  // Recorro todas las filas para cubrir casos con merge (p.ej. pm10 + pm25)
  // donde data[0] puede no contener todas las columnas.
  const locations = Array.from(
    data.reduce((set, row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "time") set.add(k);
      });
      return set;
    }, new Set<string>()),
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
      <table className="min-w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Fecha y Hora</th>
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
                <td className="border px-2 py-1 text-center">
                  {new Intl.DateTimeFormat("es-AR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Argentina/Buenos_Aires",
                  }).format(new Date(row.time))}
                </td>
                {locations.map((location) => (
                  <td key={location} className="border px-2 py-1 text-center">
                    {row[location] !== null && row[location] !== undefined
                      ? Number(row[location]).toFixed(3)
                      : "s/d"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
