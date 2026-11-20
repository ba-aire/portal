"use client";

import { AlertCircle, Eye, FileDown, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withBasePath } from "@/lib/base-path";
import {
  CONTAMINANTES,
  type Contaminante,
  ESTACIONES,
  type Estacion,
  PLANTILLAS,
  type Plantilla,
} from "@/lib/reportes/config";
import { menorQueLD, textoLimite, unidadImpresa } from "@/lib/reportes/formato";
import type { ReporteMensual } from "@/lib/reportes/models";
import { CUBIERTA, type FilaTabla } from "@/lib/reportes/tabla";
import { tablaDias, tablaEstadisticos } from "@/lib/reportes/tablas";
import { type Vista, vista } from "@/lib/reportes/vista";

// Colores de encabezado de la vista previa: los de la planilla, suavizados.
const COLORES = {
  rotulo: "#e0f7fa",
  promedio24: "#e8f5e9",
  promedio8: "#fce4ec",
  promedio1: "#fffde7",
  perfil: "#f3e5f5",
};

/** El mes anterior al actual, "AAAA-MM": el que normalmente se publica. */
export function mesAnterior(hoy = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function TablaHtml({ filas }: { filas: FilaTabla[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <tbody>
          {filas.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: filas fijas
            <tr key={i}>
              {f.celdas.map((c, j) =>
                c === CUBIERTA ? null : (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: celdas fijas
                    key={j}
                    colSpan={f.spans?.[j] ?? 1}
                    rowSpan={f.filasQueOcupa?.[j] ?? 1}
                    className="border px-1.5 py-0.5 text-center whitespace-nowrap"
                    style={{
                      backgroundColor: f.estilosCelda?.[j]?.backgroundColor as
                        | string
                        | undefined,
                      fontWeight:
                        f.estilo?.fontWeight || f.estilosCelda?.[j]?.fontWeight
                          ? 600
                          : undefined,
                    }}
                  >
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ficha({ v }: { v: Vista }) {
  return (
    <div className="grid gap-1 text-sm">
      {v.params.map((p) => {
        const f = v.ficha(p);
        const ld = v.ld(p);
        return (
          <p key={p}>
            <span className="font-medium">{v.nombre(p)}:</span>{" "}
            {f?.instrumentos ?? "sin instrumento registrado en el mes"}
            {ld !== null &&
              ` · límite de detección ${menorQueLD(ld).slice(1)} ${unidadImpresa(f?.unidad ?? "")}`}
          </p>
        );
      })}
      {v.excedencias().map((e) => (
        <p key={`${e.parameter_code}${e.window_code}`}>
          <span className="font-medium">Excedencias</span> ·{" "}
          {textoLimite(e, v.nombre(e.parameter_code), v.varios)}:{" "}
          <span
            className={e.n_excedencias > 0 ? "font-semibold text-red-700" : ""}
          >
            {e.n_excedencias}
          </span>{" "}
          de {e.n_evaluados}
        </p>
      ))}
    </div>
  );
}

export default function ReportesPanel() {
  const [mes, setMes] = useState(mesAnterior());
  const [estacion, setEstacion] = useState<Estacion>("centenario");
  const [contaminante, setContaminante] = useState<Contaminante>("co");
  const [reporte, setReporte] = useState<ReporteMensual | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const consulta = (extra: Record<string, string> = {}) =>
    new URLSearchParams({ estacion, contaminante, mes, ...extra }).toString();

  const verVistaPrevia = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(
        withBasePath(`/api/reportes/mensual?${consulta()}`),
      );
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(cuerpo?.error ?? "Error al armar el reporte");
      setReporte(cuerpo);
    } catch (e) {
      setReporte(null);
      setError(e instanceof Error ? e.message : "Error al armar el reporte");
    } finally {
      setCargando(false);
    }
  };

  const urlPdf = (plantilla: Plantilla) =>
    withBasePath(
      `/api/reportes/mensual?${consulta({ formato: "pdf", plantilla })}`,
    );
  // La misma página que imprime Gotenberg, para mirarla antes de bajar el PDF.
  // En otra pestaña: el CSP (frame-ancestors 'none') no deja embeberla.
  const urlHtml = (plantilla: Plantilla) =>
    withBasePath(`/imprimir/reporte-mensual?${consulta({ plantilla })}`);

  const v = reporte ? vista(reporte) : null;

  return (
    <div className="flex flex-col gap-6 p-4">
      <PageHeader
        title="Reportes"
        description="Reporte mensual por estación y contaminante, en PDF, desde los datos validados."
      />

      <section className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="mes">Mes</Label>
          <Input
            id="mes"
            type="month"
            value={mes}
            max={mesAnterior(new Date(Date.now() + 31 * 24 * 3600 * 1000))}
            onChange={(e) => setMes(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="estacion">Estación</Label>
          <Select
            value={estacion}
            onValueChange={(x) => setEstacion(x as Estacion)}
          >
            <SelectTrigger id="estacion" className="w-48">
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
        <div className="grid gap-1.5">
          <Label htmlFor="contaminante">Contaminante</Label>
          <Select
            value={contaminante}
            onValueChange={(x) => setContaminante(x as Contaminante)}
          >
            <SelectTrigger id="contaminante" className="w-60">
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
        <Button onClick={verVistaPrevia} disabled={cargando || !mes}>
          {cargando ? <Loader2 className="animate-spin" /> : <Search />}
          Vista previa
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {(Object.keys(PLANTILLAS) as Plantilla[]).map((p) => (
            <div key={p} className="flex">
              <Button
                variant="outline"
                asChild
                disabled={!mes}
                className="rounded-r-none"
              >
                <a
                  href={urlHtml(p)}
                  target="_blank"
                  rel="noopener"
                  title={`Ver la plantilla ${PLANTILLAS[p].nombre.toLowerCase()} en una pestaña nueva`}
                >
                  <Eye />
                  {`${PLANTILLAS[p].nombre} (v${PLANTILLAS[p].version})`}
                </a>
              </Button>
              <Button
                variant="outline"
                asChild
                disabled={!mes}
                className="-ml-px rounded-l-none"
              >
                <a href={urlPdf(p)} title={PLANTILLAS[p].descripcion}>
                  <FileDown />
                  PDF
                </a>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="size-4" /> {error}
        </p>
      )}

      {v && (
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold">
            {`${v.cfg.nombre} · ${v.estacion.nombre} · ${v.mesTitulo}`}
          </h3>
          <Ficha v={v} />
          <TablaHtml filas={tablaDias(v, 1000, COLORES).filas} />
          <h4 className="font-semibold">Parámetros estadísticos</h4>
          <TablaHtml filas={tablaEstadisticos(v, 1000, COLORES).filas} />
          <p className="text-muted-foreground text-xs">
            SD: sin dato (ninguna medición). DND: dato no disponible (no alcanza
            el criterio de validez). Los gráficos y el perfil horario están en
            el reporte completo (Ver) y en el PDF.
          </p>
        </section>
      )}
    </div>
  );
}
