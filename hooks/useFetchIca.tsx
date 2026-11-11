"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/base-path";
import type { IcaRespuesta, Indice } from "@/lib/ica/models";

// gold se recalcula cada 5 minutos y el índice es horario: pedirlo más seguido
// no trae nada nuevo.
const REFRESCO_MS = 5 * 60 * 1000;

export default function useFetchIca(indice: Indice) {
  const [data, setData] = useState<IcaRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Al cambiar de índice se descarta el pedido anterior: si llegara tarde,
    // pintaría las categorías de un índice bajo el título del otro.
    const abort = new AbortController();

    const pedir = async () => {
      try {
        const res = await fetch(withBasePath(`/api/ica?indice=${indice}`), {
          signal: abort.signal,
        });
        if (!res.ok) {
          const cuerpo = await res.json().catch(() => null);
          throw new Error(cuerpo?.error ?? "Error al obtener el índice");
        }
        setData(await res.json());
        setError(null);
      } catch (err) {
        if (abort.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    };

    setIsLoading(true);
    setData(null);
    pedir();
    const intervalo = setInterval(pedir, REFRESCO_MS);

    return () => {
      abort.abort();
      clearInterval(intervalo);
    };
  }, [indice]);

  return { data, error, isLoading };
}
