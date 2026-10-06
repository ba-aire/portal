"use client";
import { AlertCircle, FileWarning, Loader2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { FiltrosType } from "@/app/(main)/datos/contaminante/components/filters";
import SonnerToaster from "@/components/sonner-toaster";
import useFetchDatos from "@/hooks/useFetchDatos";
import { withBasePath } from "@/lib/base-path";
import { type Fuentes, filtrarSeries, STATUS_MINUTO } from "@/lib/datos/series";
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
  const [fuentes, setFuentes] = useState<Fuentes>({ silver: true, gold: true });
  const visibles = useMemo(
    () =>
      Array.isArray(data)
        ? filtrarSeries(data, filters.interval, { statuses, fuentes })
        : data,
    [data, filters.interval, statuses, fuentes],
  );

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
      {Array.isArray(data) && data.length > 0 && !isLoading && !error && (
        <>
          <SeriesControls
            interval={filters.interval}
            statuses={statuses}
            onStatusesChange={setStatuses}
            fuentes={fuentes}
            onFuentesChange={setFuentes}
            procesadoHasta={procesadoHasta}
          />
          <Chart data={visibles ?? []} />
          <Table data={visibles ?? []} />
        </>
      )}
      {Array.isArray(data) && data.length === 0 && !isLoading && !error && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
          <div className="p-6 bg-destructive/10 rounded-full mb-6 shadow-lg">
            <FileWarning className="w-16 h-16 text-yellow-500" />
          </div>
          <h3 className="text-2xl font-bold text-yellow-500 mb-3">
            No se encontraron datos.
          </h3>
        </div>
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
