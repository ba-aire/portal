"use client";

import { ChevronDownIcon, Info } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FUENTES_CRUDAS,
  type Fuentes,
  STATUS_MINUTO,
} from "@/lib/datos/series";

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

const DETALLE_VALIDADOS_HORA =
  "Promedio horario publicado: solo minutos OK, y solo si la hora tiene al menos 45 de 60 minutos válidos (75 %). Las horas que no llegan al 75 % quedan sin dato.";
const DETALLE_VALIDADOS_MOVIL =
  "Media móvil publicada, calculada sobre las horas validadas. Es válida con al menos el 75 % de las horas (6 de 8, 18 de 24). Cada punto va en el final de su ventana: el de las 08:00 es el promedio de 00:00 a 08:00.";

/** El icono "i" con el detalle de una columna al pasar el mouse. */
function InfoTip({ etiqueta, texto }: { etiqueta: string; texto: string }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Qué es ${etiqueta}`}
            className="text-muted-foreground hover:text-primary cursor-help"
          >
            <Info className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-72 text-pretty">
          {texto}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Que se muestra del resultado ya traido. Por minuto: un checkbox por status del
 * minuto en silver. Por hora: los validados (siempre) y, a elección, las tres
 * columnas crudas de silver. En las medias móviles solo hay validados. Nada de
 * esto vuelve a consultar.
 */
export default function SeriesControls({
  interval,
  statuses,
  onStatusesChange,
  fuentes,
  onFuentesChange,
  procesadoHasta,
}: SeriesControlsProps) {
  const crudasPrendidas = FUENTES_CRUDAS.filter((f) => fuentes[f.id]).length;

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
        <div className="flex flex-wrap items-center gap-6">
          <span className="flex items-center gap-2 text-sm font-medium">
            Validados
            <InfoTip
              etiqueta="Validados"
              texto={
                interval === "hour"
                  ? DETALLE_VALIDADOS_HORA
                  : DETALLE_VALIDADOS_MOVIL
              }
            />
          </span>
          {interval === "hour" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[240px] justify-between font-normal"
                >
                  {crudasPrendidas === 0
                    ? "Columnas crudas: ninguna"
                    : `Columnas crudas: ${crudasPrendidas} de ${FUENTES_CRUDAS.length}`}
                  <ChevronDownIcon />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <div className="flex flex-col gap-2">
                  {FUENTES_CRUDAS.map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`fuente-${f.id}`}
                        checked={fuentes[f.id]}
                        onCheckedChange={(v) =>
                          onFuentesChange((prev) => ({
                            ...prev,
                            [f.id]: Boolean(v),
                          }))
                        }
                      />
                      <Label
                        htmlFor={`fuente-${f.id}`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        {f.label}
                      </Label>
                      <InfoTip etiqueta={f.label} texto={f.detalle} />
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
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
