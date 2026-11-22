"use client";

import {
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { etiquetaDeHora, haceCuanto } from "@/lib/ica/presentacion";
import { cn } from "@/lib/utils";

/**
 * Elige de qué hora se ve el índice, como el visor de la EEA: un deslizador
 * con las últimas horas, paso atrás, reproducir y paso adelante. La posición
 * del extremo derecho es "Última hora": la última que tiene cada estación, que
 * es lo que se ve al entrar.
 */
export function SelectorHora({
  horas,
  hora,
  onCambiar,
  reproduciendo,
  onReproducir,
  ahora,
  cargando,
  detalleUltima,
  className,
}: {
  /** Las horas elegibles, de la más vieja a la más nueva (ISO de su inicio). */
  horas: string[];
  /** La elegida. null = la última de cada estación. */
  hora: string | null;
  onCambiar: (hora: string | null) => void;
  reproduciendo: boolean;
  onReproducir: (reproducir: boolean) => void;
  ahora: Date;
  cargando: boolean;
  /** Qué hora es "Última hora" con los datos que llegaron. */
  detalleUltima: string;
  className?: string;
}) {
  const ultima = horas.length;
  const indice = hora === null ? ultima : Math.max(0, horas.indexOf(hora));
  const horaDe = (i: number) => (i >= ultima ? null : horas[i]);

  const rotulo = hora === null ? "Última hora" : haceCuanto(hora, ahora);
  const detalle = hora === null ? detalleUltima : etiquetaDeHora(hora);

  // Mover a mano detiene la reproducción: si no, el próximo paso pisaría la
  // hora que se acaba de elegir.
  const ir = (i: number) => {
    onReproducir(false);
    onCambiar(horaDe(Math.min(ultima, Math.max(0, i))));
  };

  return (
    <section
      aria-label="Hora del índice"
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-primary/15 bg-white/95 p-3 text-gray-900 shadow-md shadow-black/15",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          // El rótulo cambia con cada paso: que el lector de pantalla lo diga.
          aria-live="polite"
          className="rounded-md bg-secondary/40 px-2 py-0.5 text-sm font-semibold text-primary"
        >
          {rotulo}
        </span>
        <div className="flex items-center gap-1">
          {cargando && (
            <Loader2
              aria-label="Cargando"
              className="mr-1 size-4 animate-spin text-primary"
            />
          )}
          <Button
            type="button"
            size="icon"
            className="size-8"
            aria-label="Hora anterior"
            disabled={indice === 0}
            onClick={() => ir(indice - 1)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            type="button"
            size="icon"
            className="size-8"
            aria-label={
              reproduciendo ? "Pausar" : "Reproducir las últimas horas"
            }
            onClick={() => {
              if (reproduciendo) return onReproducir(false);
              // Desde "Última hora" no hay adelante: arranca desde la primera.
              if (hora === null) onCambiar(horas[0]);
              onReproducir(true);
            }}
          >
            {reproduciendo ? <Pause /> : <Play />}
          </Button>
          <Button
            type="button"
            size="icon"
            className="size-8"
            aria-label="Hora siguiente"
            disabled={indice === ultima}
            onClick={() => ir(indice + 1)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={ultima}
        step={1}
        value={indice}
        onChange={(e) => ir(Number(e.target.value))}
        aria-label="Hora"
        aria-valuetext={detalle ? `${rotulo}: ${detalle}` : rotulo}
        className="w-full cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-[11px] text-gray-500">
        <span>Hace {ultima} h</span>
        <span>Última</span>
      </div>

      <p className="text-sm font-medium text-primary">{detalle}</p>
    </section>
  );
}
