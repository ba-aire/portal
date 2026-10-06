"use client";

import { ChevronDownIcon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type Fuentes, STATUS_MINUTO } from "@/lib/datos/series";

interface SeriesControlsProps {
  interval: string;
  statuses: ReadonlySet<string>;
  // Setters de React y no callbacks con el valor nuevo: cada cambio se calcula
  // sobre el estado vigente, aunque dos clics lleguen antes de un render.
  onStatusesChange: Dispatch<SetStateAction<Set<string>>>;
  fuentes: Fuentes;
  onFuentesChange: Dispatch<SetStateAction<Fuentes>>;
  procesadoHasta: string | null;
}

const formatoFecha = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * Que se muestra del resultado ya traido. Por minuto: un checkbox por status del
 * minuto en silver. Por hora y por dia: silver (todo lo que paso) y gold (solo
 * las ventanas validas, >= 75 %), por separado. Nada de esto vuelve a consultar.
 */
export default function SeriesControls({
  interval,
  statuses,
  onStatusesChange,
  fuentes,
  onFuentesChange,
  procesadoHasta,
}: SeriesControlsProps) {
  const toggleStatus = (value: string, checked: boolean) => {
    onStatusesChange((prev) => {
      const set = new Set(prev);
      if (checked) set.add(value);
      else set.delete(value);
      return set;
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-6 px-2">
      {interval === "minute" ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[240px] justify-between font-normal"
            >
              {statuses.size === STATUS_MINUTO.length
                ? "Todos los status"
                : `${statuses.size} de ${STATUS_MINUTO.length} status`}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="flex flex-col gap-2">
              {STATUS_MINUTO.map((s) => (
                <label
                  key={s.value}
                  htmlFor={`status-${s.value}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    id={`status-${s.value}`}
                    checked={statuses.has(s.value)}
                    onCheckedChange={(v) => toggleStatus(s.value, Boolean(v))}
                  />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuente-silver"
              checked={fuentes.silver}
              onCheckedChange={(v) =>
                onFuentesChange((prev) => ({ ...prev, silver: Boolean(v) }))
              }
            />
            <Label htmlFor="fuente-silver" className="cursor-pointer">
              Silver{" "}
              <span className="text-muted-foreground">(minutos válidos)</span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuente-gold"
              checked={fuentes.gold}
              onCheckedChange={(v) =>
                onFuentesChange((prev) => ({ ...prev, gold: Boolean(v) }))
              }
            />
            <Label htmlFor="fuente-gold" className="cursor-pointer">
              Gold{" "}
              <span className="text-muted-foreground">(válido con ≥ 75 %)</span>
            </Label>
          </div>
        </div>
      )}
      {procesadoHasta && (
        <span className="text-sm text-muted-foreground">
          Datos procesados hasta las{" "}
          {formatoFecha.format(new Date(procesadoHasta))}
        </span>
      )}
    </div>
  );
}
