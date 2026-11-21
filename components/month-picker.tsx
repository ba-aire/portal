"use client";

import { ChevronDownIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * @file Selector de mes y año ("AAAA-MM").
 * @description shadcn/ui no trae uno: su Calendar con captionLayout="dropdown"
 * obliga a elegir un día. Este usa las mismas piezas (Popover y Button) y se ve
 * como los selectores de fecha de Explorar Datos: un botón con el mes elegido y,
 * al abrirlo, el año con flechas y los doce meses en una grilla.
 */

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** "AAAA-MM" del mes en curso. */
export function mesActual(hoy = new Date()): string {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → "Septiembre 2026". */
export function etiquetaMes(valor: string): string {
  const [anio, mes] = valor.split("-");
  return `${MESES[Number(mes) - 1]} ${anio}`;
}

/** true si "AAAA-MM" está entre `desde` y `hasta` (incluidos, mismo formato). */
export function mesEnRango(valor: string, desde: string, hasta: string) {
  return valor >= desde && valor <= hasta;
}

type Props = {
  id?: string;
  /** "AAAA-MM" */
  value: string;
  onChange: (valor: string) => void;
  /** El primer mes que se puede elegir, "AAAA-MM". */
  desde: string;
  /** El último, "AAAA-MM". Por defecto el mes en curso: lo futuro no se ofrece. */
  hasta?: string;
  disabled?: boolean;
  className?: string;
};

export default function MonthPicker({
  id,
  value,
  onChange,
  desde,
  hasta = mesActual(),
  disabled,
  className,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  // El año que muestra la grilla; arranca en el del mes elegido.
  const [anio, setAnio] = useState(Number(value.slice(0, 4)));
  const anioMin = Number(desde.slice(0, 4));
  const anioMax = Number(hasta.slice(0, 4));

  return (
    <Popover
      open={abierto}
      onOpenChange={(o) => {
        setAbierto(o);
        if (o) setAnio(Number(value.slice(0, 4)));
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          id={id}
          disabled={disabled}
          className={cn("w-48 justify-between font-normal", className)}
        >
          {etiquetaMes(value)}
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 text-primary" align="start">
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Año anterior"
            disabled={anio <= anioMin}
            onClick={() => setAnio((a) => a - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="font-semibold" aria-live="polite">
            {anio}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Año siguiente"
            disabled={anio >= anioMax}
            onClick={() => setAnio((a) => a + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MESES.map((nombre, i) => {
            const valor = `${anio}-${String(i + 1).padStart(2, "0")}`;
            const elegido = valor === value;
            return (
              <Button
                key={nombre}
                variant="ghost"
                size="sm"
                aria-label={`${nombre} ${anio}`}
                aria-pressed={elegido}
                disabled={!mesEnRango(valor, desde, hasta)}
                onClick={() => {
                  onChange(valor);
                  setAbierto(false);
                }}
                className={cn(
                  "font-normal",
                  elegido &&
                    "bg-secondary font-semibold text-primary hover:bg-secondary/90",
                )}
              >
                {nombre.slice(0, 3)}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
