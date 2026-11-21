"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  nombreDelReporte,
  type Pedido,
  type Reporte,
  reporteDe,
  reportesPorTipo,
  TIPOS,
} from "@/lib/reportes/catalogo";
import FiltrosMensualPanel from "./filtros-mensual";

/**
 * La cabecera de /reportes: primero se elige la plantilla del reporte (el
 * catálogo de lib/reportes/catalogo.ts) y abajo aparecen los filtros de su
 * tipo. Cada tipo trae su propio componente de filtros: el mensual pide mes,
 * estación y contaminante; uno diario o anual pedirá otra cosa.
 */
export default function ReportesPanel({
  reporte,
  pedido,
}: {
  /** El reporte elegido (?reporte=…), o null si todavía no se eligió. */
  reporte: Reporte | null;
  /** Lo que se está mostrando en la vista previa, o null. */
  pedido: Pedido | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [cambiando, startTransition] = useTransition();

  // Cambiar de plantilla dentro del mismo tipo conserva los filtros de la vista
  // previa (el mismo mes, ahora en la otra plantilla); cambiar de tipo no.
  const elegir = (id: string) => {
    const nuevo = reporteDe(id);
    const q = new URLSearchParams({ reporte: id });
    if (nuevo && pedido && pedido.tipo === nuevo.tipo) {
      for (const [k, v] of Object.entries(pedido.filtros)) q.set(k, v);
    }
    startTransition(() => {
      router.replace(`${pathname}?${q}`, { scroll: false });
    });
  };

  return (
    <div className="p-2">
      <header className="mb-10">
        <h1 className="text-2xl font-bold text-primary text-center relative z-10 uppercase tracking-wider mb-2">
          Reportes
        </h1>
        <h2 className="text-primary/70 text-center font-semibold">
          Elegí la plantilla del reporte y completá sus filtros. Se arma con los
          datos validados; la vista previa es igual al PDF que se descarga.
        </h2>
      </header>

      <div className="mb-6 flex justify-center text-primary">
        <div className="flex flex-col gap-3">
          <Label htmlFor="reporte" className="px-1">
            Plantilla del reporte
          </Label>
          <Select
            value={reporte?.id ?? ""}
            onValueChange={elegir}
            disabled={cambiando}
          >
            <SelectTrigger id="reporte" className="w-[300px]">
              <SelectValue placeholder="Seleccioná la plantilla del reporte" />
            </SelectTrigger>
            <SelectContent>
              {reportesPorTipo().map(({ tipo, reportes }) => (
                <SelectGroup key={tipo}>
                  <SelectLabel>{TIPOS[tipo].nombre}</SelectLabel>
                  {reportes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {nombreDelReporte(r)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Los filtros del tipo elegido. `key` por tipo: entre plantillas del
          mismo tipo los filtros quedan como estaban. */}
      {reporte?.tipo === "mensual" && (
        <FiltrosMensualPanel
          key="mensual"
          reporte={reporte}
          vistaPrevia={pedido?.tipo === "mensual" ? pedido.filtros : null}
        />
      )}
    </div>
  );
}
