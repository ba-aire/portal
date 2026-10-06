import { useState } from "react";
import { withBasePath } from "@/lib/base-path";
import type { FiltrosType } from "../app/(main)/datos/contaminante/components/filters";

export interface DataRow extends Record<string, string | number> {
  time: string;
}

export default function useFetchDatos() {
  const [data, setData] = useState<DataRow[] | undefined>(undefined);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchDatos = async (filters: FiltrosType) => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        contaminant: filters.metrica,
        interval: filters.interval,
        locations: filters.locations,
        startDate: filters.startDate ? filters.startDate.toISOString() : "",
        endDate: filters.endDate ? filters.endDate.toISOString() : "",
      });
      const response = await fetch(
        withBasePath(`/api/datos?${params.toString()}`),
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

  return { data, error, isLoading, fetchDatos };
}
