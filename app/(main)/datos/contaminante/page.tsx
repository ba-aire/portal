"use client";
import { AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { FiltrosType } from "@/app/(main)/datos/contaminante/components/filters";
import { SinDatos } from "@/components/sin-datos";
import SonnerToaster from "@/components/sonner-toaster";
import useFetchDatos from "@/hooks/useFetchDatos";
import { withBasePath } from "@/lib/base-path";
import {
  FUENTES_INICIAL,
  type Fuentes,
  filtrarSeries,
  STATUS_MINUTO,
  tieneValores,
} from "@/lib/datos/series";
import type { Periodo } from "@/lib/periodo";
import Chart from "./components/chart";
import Filtros from "./components/filters";
import SeriesControls from "./components/series-controls";
import Table from "./components/table";

export default function CrudosPage() {
  const [filters, setFilters] = useState<FiltrosType>({
    metrica: "co",
    interval: "hour",
    startDate: undefined,
    endDate: undefined,
    locations: "",
  });
  const { data, error, isLoading, procesadoHasta, fetchDatos } =
    useFetchDatos();
  // Que mostrar del resultado: por defecto, todo. Cambiarlo no vuelve a consultar.
  const [statuses, setStatuses] = useState<Set<string>>(
    () => new Set(STATUS_MINUTO.map((s) => s.value)),
  );
  const [fuentes, setFuentes] = useState<Fuentes>(FUENTES_INICIAL);
  const visibles = useMemo(
    () =>
      Array.isArray(data)
        ? filtrarSeries(data, filters.interval, { statuses, fuentes })
        : data,
    [data, filters.interval, statuses, fuentes],
  );

  const conValores = Array.isArray(data) && tieneValores(data);
  // Lo que hay puede estar todo en columnas apagadas (sin validados todavía, y
  // los crudos ocultos por defecto): en vez de un gráfico vacío, se avisa.
  const visiblesConValores = Array.isArray(visibles) && tieneValores(visibles);

  const handleFetch = (newFilters: FiltrosType) => {
    setFilters(newFilters);
    fetchDatos(newFilters);
  };

  return (
    <div className="space-y-8">
      <SonnerToaster />
      <Filtros
        currentFilters={filters}
        isLoading={isLoading}
        onFetch={handleFetch}
      />
      {isLoading && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
          <div className="p-6 bg-primary/10 rounded-full mb-6">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
          </div>
          <h3 className="text-2xl font-bold text-primary mb-3">
            Cargando Datos
          </h3>
        </div>
      )}
      {error && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
          <div className="p-6 bg-destructive/10 rounded-full mb-6 shadow-lg">
            <AlertCircle className="w-16 h-16 text-destructive" />
          </div>
          <h3 className="text-2xl font-bold text-destructive mb-3">
            Ocurrió el siguiente error:
          </h3>
          <p className="text-destructive/80 mb-6 max-w-lg text-lg">{error}</p>
        </div>
      )}
      {conValores && !isLoading && !error && (
        <>
          <SeriesControls
            interval={filters.interval}
            statuses={statuses}
            onStatusesChange={setStatuses}
            fuentes={fuentes}
            onFuentesChange={setFuentes}
            procesadoHasta={procesadoHasta}
          />
          {visiblesConValores ? (
            <>
              <Chart data={visibles ?? []} />
              <Table
                data={visibles ?? []}
                interval={filters.interval as Periodo}
              />
            </>
          ) : (
            <SinDatos
              titulo="No hay datos para lo que elegiste mostrar"
              sugerencia="En este rango no hay datos validados. Elegí columnas crudas para ver lo medido."
            />
          )}
        </>
      )}
      {Array.isArray(data) && !conValores && !isLoading && !error && (
        <SinDatos />
      )}
      {data === undefined && !isLoading && !error && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
          <Image
            src={withBasePath("/data-search.png")}
            alt="No hay datos"
            width={400}
            height={400}
          />
        </div>
      )}
    </div>
  );
}
