"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/base-path";
import type { IcaRespuesta, Indice } from "@/lib/ica/models";

// gold se recalcula cada 5 minutos y el índice es horario: pedirlo más seguido
// no trae nada nuevo.
const REFRESCO_MS = 5 * 60 * 1000;

// Las horas pasadas casi no cambian (solo con una revisión o una carga manual,
// que el hourly de data aplica en sus 5 minutos). Se guardan ese mismo tiempo:
// al reproducir el selector por segunda vez, o al volver a una hora, no se
// pide de nuevo. Son a lo sumo 48 horas por índice.
const cache = new Map<
  string,
  { vence: number; pedido: Promise<IcaRespuesta> }
>();

async function pedir(indice: Indice, hora: string | null) {
  const params = new URLSearchParams({ indice });
  if (hora) params.set("hora", hora);
  const res = await fetch(withBasePath(`/api/ica?${params}`));
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(cuerpo?.error ?? "Error al obtener el índice");
  }
  return (await res.json()) as IcaRespuesta;
}

/** El índice de una hora (null = la última de cada estación). */
export function obtenerIca(
  indice: Indice,
  hora: string | null,
): Promise<IcaRespuesta> {
  // La última hora no se guarda: es la que se refresca.
  if (hora === null) return pedir(indice, null);

  const clave = `${indice}|${hora}`;
  const guardado = cache.get(clave);
  if (guardado && guardado.vence > Date.now()) return guardado.pedido;

  const pedido = pedir(indice, hora);
  cache.set(clave, { vence: Date.now() + REFRESCO_MS, pedido });
  // Un error no queda guardado: el próximo intento vuelve a pedir.
  pedido.catch(() => cache.delete(clave));
  return pedido;
}

/** Pide una hora por adelantado (la siguiente, al reproducir), sin esperarla. */
export function precargarIca(indice: Indice, hora: string) {
  obtenerIca(indice, hora).catch(() => {});
}

/**
 * El índice elegido, en la hora elegida. `data` es la ÚLTIMA respuesta que
 * llegó, que puede ser de otra hora o de otro índice mientras llega la nueva:
 * trae `indice` y `hora`, y la pantalla compara antes de mostrarla.
 */
export default function useFetchIca(indice: Indice, hora: string | null) {
  const [data, setData] = useState<IcaRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Al cambiar de índice o de hora se descarta el pedido anterior: si llegara
    // tarde, pintaría las categorías de un índice bajo el título del otro, o
    // una hora con el rótulo de otra. No se aborta el fetch porque puede ser el
    // mismo que espera la caché.
    let vigente = true;

    const cargar = async () => {
      setIsLoading(true);
      try {
        const respuesta = await obtenerIca(indice, hora);
        if (!vigente) return;
        setData(respuesta);
        setError(null);
      } catch (err) {
        if (!vigente) return;
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        if (vigente) setIsLoading(false);
      }
    };

    cargar();
    // Solo la última hora cambia sola; una hora pasada no se refresca.
    const intervalo =
      hora === null ? setInterval(cargar, REFRESCO_MS) : undefined;

    return () => {
      vigente = false;
      clearInterval(intervalo);
    };
  }, [indice, hora]);

  return { data, error, isLoading };
}
