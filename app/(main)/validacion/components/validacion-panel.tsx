"use client";

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import SonnerToaster from "@/components/sonner-toaster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { withBasePath } from "@/lib/base-path";
import {
  type Catalogo,
  ETIQUETA_ACCION,
  type Revision,
} from "@/lib/revision/models";
import { etiquetaSerie, formatearInstante } from "@/lib/revision/presentacion";
import AnularRevision from "./anular-revision";
import NuevaRevision from "./nueva-revision";

const TODAS = "__todas__";

export default function ValidacionPanel({
  catalogo,
  puedeEditar,
}: {
  catalogo: Catalogo | null;
  puedeEditar: boolean;
}) {
  const [estacion, setEstacion] = useState(TODAS);
  const [estado, setEstado] = useState<"vigentes" | "todas">("vigentes");
  const [revisiones, setRevisiones] = useState<Revision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const q = new URLSearchParams({ estado });
    if (estacion !== TODAS) q.set("station_code", estacion);
    try {
      const res = await fetch(withBasePath(`/api/revisiones?${q}`));
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(cuerpo?.error ?? "Error al listar");
      setRevisiones(cuerpo);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setCargando(false);
    }
  }, [estacion, estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const parametros = catalogo?.parametros ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <SonnerToaster />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Validación"
          description="Minutos invalidados y alarmas reincorporadas a mano. Se aplican en la próxima corrida del pipeline (cada 5 minutos): la horaria y gold se recalculan sin borrar nada."
        />
        {puedeEditar && catalogo && (
          <NuevaRevision catalogo={catalogo} onRegistrada={cargar} />
        )}
      </div>

      {!catalogo && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          No se pudo leer el catálogo de estaciones y parámetros.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label>Estación</Label>
          <Select value={estacion} onValueChange={setEstacion}>
            <SelectTrigger className="w-48 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas</SelectItem>
              {catalogo?.estaciones.map((e) => (
                <SelectItem key={e.station_code} value={e.station_code}>
                  {e.station_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Mostrar</Label>
          <Select
            value={estado}
            onValueChange={(v) => setEstado(v as "vigentes" | "todas")}
          >
            <SelectTrigger className="w-48 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vigentes">Solo vigentes</SelectItem>
              <SelectItem value="todas">También las anuladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={cargar} disabled={cargando}>
          {cargando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Actualizar
        </Button>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}

      {revisiones && revisiones.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          No hay revisiones con estos filtros.
        </p>
      )}

      {revisiones && revisiones.length > 0 && (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Estación</TableHead>
                <TableHead>Serie</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Registrada</TableHead>
                <TableHead>Estado</TableHead>
                {puedeEditar && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {revisiones.map((r) => (
                <TableRow
                  key={r.revision_id}
                  className={r.anulacion ? "text-muted-foreground" : undefined}
                >
                  <TableCell>{r.revision_id}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.accion === "invalidar" ? "destructive" : "secondary"
                      }
                    >
                      {ETIQUETA_ACCION[r.accion]}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.station_name}</TableCell>
                  <TableCell>{etiquetaSerie(r, parametros)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatearInstante(r.desde)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatearInstante(r.hasta)}
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-pre-wrap">
                    {r.motivo}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatearInstante(r.registrado_en)}
                    <br />
                    {r.registrado_por}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.anulacion ? (
                      <span title={r.anulacion.motivo}>
                        Anulada el{" "}
                        {formatearInstante(r.anulacion.registrado_en)} por{" "}
                        {r.anulacion.registrado_por}: {r.anulacion.motivo}
                      </span>
                    ) : (
                      <Badge variant="outline">Vigente</Badge>
                    )}
                  </TableCell>
                  {puedeEditar && (
                    <TableCell>
                      {!r.anulacion && (
                        <AnularRevision
                          revision={r}
                          serie={etiquetaSerie(r, parametros)}
                          onAnulada={cargar}
                        />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
