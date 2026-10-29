import { useState } from "react";
import { withBasePath } from "@/lib/base-path";
import { ventanaMinutal } from "@/lib/rango-minutal";
import type { FiltrosType } from "../app/(main)/descargas/components/filters";

export interface DataRow extends Record<string, string | number> {
  time: string;
}
export default function useFetchDescargas() {
  const [data, setData] = useState<DataRow[] | undefined>(undefined);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchDescargas = async (filters: FiltrosType) => {
    setIsLoading(true);
    setError("");
    try {
      // Minutales: un día y una franja horaria. El resto: de fecha a fecha.
      const { startDate } = filters;
      const ventana =
        filters.integration === "minute" && startDate
          ? ventanaMinutal(startDate, filters.startHour, filters.endHour)
          : undefined;
      const params = new URLSearchParams({
        integration: filters.integration,
        location: filters.location,
        startDate: ventana
          ? ventana.start.toISOString()
          : filters.startDate
            ? filters.startDate.toISOString()
            : "",
        // "Hasta el 6" es hasta el FINAL del 6: el calendario da la medianoche del
        // dia elegido, y la API filtra con `< endDate`. Igual que en /datos.
        endDate: ventana
          ? ventana.end.toISOString()
          : filters.endDate
            ? new Date(
                filters.endDate.getTime() + 24 * 60 * 60 * 1000,
              ).toISOString()
            : "",
      });
      const response = await fetch(
        withBasePath(`/api/descargas?${params.toString()}`),
      );
      if (!response.ok) {
        const errorText = await response.text();
        setError(errorText || "Error al obtener los datos");
        setData([]);
      } else {
        const rawData = await response.json();
        setData(Array.isArray(rawData.data) ? rawData.data : []);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Error inesperado");
      } else {
        setError("Error inesperado");
      }
      setData([]);
    }
    setIsLoading(false);
  };
  return { data, error, isLoading, fetchDescargas };
}
