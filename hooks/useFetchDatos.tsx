import { useState } from "react";
import { withBasePath } from "@/lib/base-path";
import type { FiltrosType } from "../app/(main)/datos/contaminante/components/filters";

export interface DataRow extends Record<string, string | number | null> {
  time: string;
}

export default function useFetchDatos() {
  const [data, setData] = useState<DataRow[] | undefined>(undefined);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Hasta donde proceso silver: la ultima hora casi nunca esta (los jobs corren
  // cada hora), y la UI lo avisa.
  const [procesadoHasta, setProcesadoHasta] = useState<string | null>(null);

  const fetchDatos = async (filters: FiltrosType) => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        contaminant: filters.metrica,
        interval: filters.interval,
        locations: filters.locations,
        startDate: filters.startDate ? filters.startDate.toISOString() : "",
        // "Hasta el 6" es hasta el FINAL del 6: el calendario da la medianoche del
        // dia elegido, y la API filtra con `< endDate`. Sin el +1 dia, elegir el
        // mismo dia en los dos campos daba un rango vacio. Argentina no tiene
        // horario de verano: 24 h son siempre un dia.
        endDate: filters.endDate
          ? new Date(
              filters.endDate.getTime() + 24 * 60 * 60 * 1000,
            ).toISOString()
          : "",
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
        setProcesadoHasta(rawData.meta?.procesadoHasta ?? null);
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

  return { data, error, isLoading, procesadoHasta, fetchDatos };
}
