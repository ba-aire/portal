import { useState } from "react";
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
      const params = new URLSearchParams({
        integration: filters.integration,
        location: filters.location,
        startDate: filters.startDate ? filters.startDate.toISOString() : "",
        endDate: filters.endDate ? filters.endDate.toISOString() : "",
      });
      const response = await fetch(`/api/descargas?${params.toString()}`);
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
