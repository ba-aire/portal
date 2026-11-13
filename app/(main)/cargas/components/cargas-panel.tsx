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
import type { Carga } from "@/lib/carga/models";
import { formatearHoraArgentina } from "@/lib/carga/parser";
import type { Catalogo } from "@/lib/revision/models";
import { formatearInstante } from "@/lib/revision/presentacion";
import AnularCarga from "./anular-carga";
import NuevaCarga from "./nueva-carga";

const TODAS = "__todas__";

export default function CargasPanel({
  catalogo,
  puedeEditar,
}: {
  catalogo: Catalogo | null;
  puedeEditar: boolean;
}) {
  const [estacion, setEstacion] = useState(TODAS);
  const [estado, setEstado] = useState<"vigentes" | "todas">("vigentes");
  const [cargas, setCargas] = useState<Carga[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const q = new URLSearchParams({ estado });
    if (estacion !== TODAS) q.set("station_code", estacion);
    try {
      const res = await fetch(withBasePath(`/api/cargas?${q}`));
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(cuerpo?.error ?? "Error al listar");
      setCargas(cuerpo);
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

  const nombre = (codigo: string) =>
    catalogo?.parametros.find((p) => p.parameter_code === codigo)
      ?.display_name ?? codigo;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <SonnerToaster />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Carga de datos"
          description="Promedios horarios ya validados que se cargan a mano, por ejemplo lo que se baja de un analizador después de un corte. La hora cargada reemplaza a la medida y se publica como válida en la próxima corrida del pipeline (cada 5 minutos)."
        />
        {puedeEditar && catalogo && (
          <NuevaCarga catalogo={catalogo} onCargada={cargar} />
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

      {cargas && cargas.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          No hay cargas con estos filtros.
        </p>
      )}

      {cargas && cargas.length > 0 && (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Estación</TableHead>
                <TableHead>Parámetros</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead className="text-right">Valores</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Registrada</TableHead>
                <TableHead>Estado</TableHead>
                {puedeEditar && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargas.map((c) => (
                <TableRow
                  key={c.carga_id}
                  className={c.anulacion ? "text-muted-foreground" : undefined}
                >
                  <TableCell>{c.carga_id}</TableCell>
                  <TableCell>{c.station_name}</TableCell>
                  <TableCell>{c.parametros.map(nombre).join(", ")}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.desde ? formatearHoraArgentina(c.desde) : ""}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.hasta ? formatearHoraArgentina(c.hasta) : ""}
                  </TableCell>
                  <TableCell className="text-right">{c.n_horas}</TableCell>
                  <TableCell className="max-w-xs whitespace-pre-wrap">
                    {c.motivo}
                    {c.archivo && (
                      <span className="block text-xs text-muted-foreground">
                        {c.archivo}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatearInstante(c.registrado_en)}
                    <br />
                    {c.registrado_por}
                    {c.origen === "historico" && (
                      <Badge variant="secondary" className="ml-2">
                        Histórico
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.anulacion ? (
                      <span>
                        Anulada el{" "}
                        {formatearInstante(c.anulacion.registrado_en)} por{" "}
                        {c.anulacion.registrado_por}: {c.anulacion.motivo}
                      </span>
                    ) : (
                      <Badge variant="outline">Vigente</Badge>
                    )}
                  </TableCell>
                  {puedeEditar && (
                    <TableCell>
                      {!c.anulacion && (
                        <AnularCarga carga={c} onAnulada={cargar} />
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
