"use client";

import { Download, Loader2, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import MonthPicker from "@/components/month-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withBasePath } from "@/lib/base-path";
import type { FiltrosMensual, Reporte } from "@/lib/reportes/catalogo";
import {
  CONTAMINANTES,
  type Contaminante,
  ESTACIONES,
  type Estacion,
} from "@/lib/reportes/config";

/** El mes anterior al actual, "AAAA-MM": el que normalmente se publica. */
export function mesAnterior(hoy = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** El primer mes que ofrece el selector: diez años hacia atrás. */
export function primerMes(hoy = new Date()): string {
  return `${hoy.getFullYear() - 9}-01`;
}

/** "co_centenario_septiembre_2026.pdf", del Content-Disposition. */
function archivoDe(res: Response, porDefecto: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  return /filename="([^"]+)"/.exec(cd)?.[1] ?? porDefecto;
}

// Los mismos estilos que los filtros de Explorar Datos (skill sirca-design).
export const BOTON_PRINCIPAL =
  "btn btn-primary text-primary bg-secondary hover:bg-secondary/90 hover:shadow-primary active:shadow-none active:scale-99 mt-auto cursor-pointer select-none transition-all";
export const BOTON_SECUNDARIO =
  "text-primary hover:shadow-primary active:shadow-none active:scale-99 mt-auto cursor-pointer select-none transition-all";

/**
 * Los filtros de los reportes de tipo "mensual" (todas sus plantillas): mes,
 * estación y contaminante, más "Vista previa" y "Descargar".
 *
 * `vistaPrevia` son los filtros del reporte que se está mostrando (los de la
 * URL), o null si no hay ninguno.
 */
export default function FiltrosMensualPanel({
  reporte,
  vistaPrevia,
}: {
  reporte: Reporte;
  vistaPrevia: FiltrosMensual | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mes, setMes] = useState(vistaPrevia?.mes ?? mesAnterior());
  const [estacion, setEstacion] = useState<Estacion>(
    vistaPrevia?.estacion ?? "centenario",
  );
  const [contaminante, setContaminante] = useState<Contaminante>(
    vistaPrevia?.contaminante ?? "co",
  );
  const [armando, startTransition] = useTransition();
  const [descargando, setDescargando] = useState(false);

  const filtros = { estacion, contaminante, mes };

  // El reporte se arma en el servidor, según la URL (ver page.tsx).
  const verVistaPrevia = () => {
    const q = new URLSearchParams({ reporte: reporte.id, ...filtros });
    startTransition(() => {
      router.replace(`${pathname}?${q}`, { scroll: false });
    });
  };

  // Por fetch y no con un link: si Gotenberg no está o falla, la respuesta es
  // un JSON con el error, y eso va a un aviso en vez de abrirse como página.
  const descargar = async () => {
    setDescargando(true);
    try {
      const q = new URLSearchParams({
        ...filtros,
        plantilla: reporte.plantilla,
        formato: "pdf",
      });
      const res = await fetch(withBasePath(`/api/reportes/mensual?${q}`));
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null);
        throw new Error(cuerpo?.error ?? "No se pudo generar el PDF");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = archivoDe(res, "reporte.pdf");
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF");
    } finally {
      setDescargando(false);
    }
  };

  const ocupado = armando || descargando;
  // Se descarga lo que se está viendo: sin vista previa, o si los filtros ya no
  // son los de la vista previa en pantalla, no hay nada que descargar.
  const hayVistaPrevia =
    vistaPrevia !== null &&
    vistaPrevia.estacion === estacion &&
    vistaPrevia.contaminante === contaminante &&
    vistaPrevia.mes === mes;

  return (
    // En el teléfono, un filtro debajo del otro y todos del mismo ancho; desde
    // md, en fila con los botones alineados abajo.
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 text-primary md:max-w-none md:flex-row md:flex-wrap md:items-end md:justify-center">
      <div className="flex flex-col gap-3">
        <Label htmlFor="mes" className="px-1">
          Mes
        </Label>
        <MonthPicker
          id="mes"
          value={mes}
          onChange={setMes}
          desde={primerMes()}
          disabled={ocupado}
          className="w-full md:w-48"
        />
      </div>

      <div className="flex flex-col gap-3">
        <Label htmlFor="estacion" className="px-1">
          Estación
        </Label>
        <Select
          value={estacion}
          onValueChange={(x) => setEstacion(x as Estacion)}
          disabled={ocupado}
        >
          <SelectTrigger id="estacion" className="w-full md:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ESTACIONES) as Estacion[]).map((e) => (
              <SelectItem key={e} value={e}>
                {ESTACIONES[e].nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        <Label htmlFor="contaminante" className="px-1">
          Contaminante
        </Label>
        <Select
          value={contaminante}
          onValueChange={(x) => setContaminante(x as Contaminante)}
          disabled={ocupado}
        >
          <SelectTrigger id="contaminante" className="w-full md:w-[230px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CONTAMINANTES) as Contaminante[]).map((c) => (
              <SelectItem key={c} value={c}>
                {CONTAMINANTES[c].nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        className={BOTON_PRINCIPAL}
        onClick={verVistaPrevia}
        disabled={ocupado}
      >
        {armando ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
        Vista previa
      </Button>
      <Button
        variant="outline"
        className={BOTON_SECUNDARIO}
        onClick={descargar}
        disabled={ocupado || !hayVistaPrevia}
        title={
          hayVistaPrevia
            ? "Descargar en PDF el reporte de la vista previa"
            : "Generá la vista previa para poder descargarlo"
        }
      >
        {descargando ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Descargar
      </Button>
    </div>
  );
}
