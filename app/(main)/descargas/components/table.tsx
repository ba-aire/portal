import { TABLE_CONFIG } from "@/lib/descargas/config";
import type { DataPoint } from "@/lib/descargas/models";

interface TableProps {
  data: DataPoint[];
}

export default function Table({ data }: TableProps) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="overflow-x-auto p-2">
        <span className="text-gray-500">No hay datos para mostrar</span>
      </div>
    );
  }

  // Generar orden de columnas basado en TABLE_CONFIG
  const orderedFields: string[] = [];
  Object.entries(TABLE_CONFIG).forEach(([tableKey, config]) => {
    // Agregar métricas de cada tabla
    config.metrics.forEach((metric) => {
      const fieldName = metric.replace("_mean", "");
      if (data.some((row) => fieldName in row)) {
        orderedFields.push(fieldName);
      }
    });
    // Agregar campos de status de cada tabla: el status del minuto (minutal) o
    // los status observados en la hora, más el conteo de minutos k (horaria)
    const statusField = `${tableKey}_status`;
    if (data.some((row) => statusField in row)) {
      orderedFields.push(statusField);
    }
    const kStatusField = `${tableKey}_k_status`;
    if (data.some((row) => kStatusField in row)) {
      orderedFields.push(kStatusField);
    }
  });

  // Agregar cualquier campo adicional que no esté en TABLE_CONFIG. Las series
  // _raw quedan fuera de la vista previa: se muestran en el Excel descargado.
  const allFields = new Set<string>();
  data.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key !== "time" && !key.endsWith("_raw")) {
        allFields.add(key);
      }
    });
  });

  allFields.forEach((field) => {
    if (!orderedFields.includes(field)) {
      orderedFields.push(field);
    }
  });

  const locations = orderedFields;

  // Helper function to format cell values
  const formatCellValue = (
    value: string | number | null | undefined,
  ): string => {
    if (value === null || value === undefined) {
      return "s/d";
    }
    // Handle Status type ("k" or "i")
    if (value === "k" || value === "i") {
      return value.toUpperCase();
    }
    // Handle string values
    if (typeof value === "string") {
      return value;
    }
    // Handle number values
    if (typeof value === "number") {
      return Number(value).toFixed(3);
    }
    return String(value);
  };

  return (
    <div className="overflow-x-auto p-2">
      <table className="min-w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Fecha y Hora</th>
            {locations.map((location) => (
              <th key={location} className="border px-2 py-1 capitalize">
                {location === "catalinas"
                  ? "La Boca"
                  : location.charAt(0).toUpperCase() + location.slice(1)}
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
                    {formatCellValue(row[location])}
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
