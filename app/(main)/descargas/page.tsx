"use client";
import { AlertCircle, FileDown, FileWarning, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import SonnerToaster from "@/components/sonner-toaster";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useFetchDescargas from "@/hooks/useFetchDescargas";
import {
  downloadAsCSV,
  downloadAsExcel,
  generateFilename,
} from "@/lib/descargas/file-download";
import Filtros, { type FiltrosType } from "./components/filters";
import Table from "./components/table";

export default function DescargasPage() {
  const [filters, setFilters] = useState<FiltrosType>({
    integration: "hour",
    location: "centenario",
    startDate: undefined,
    endDate: undefined,
  });
  const [downloadFormat, setDownloadFormat] = useState<"csv" | "xlsx">("xlsx");
  const { data, error, isLoading, fetchDescargas } = useFetchDescargas();

  const handleFetch = (newFilters: FiltrosType) => {
    setFilters(newFilters);
    fetchDescargas(newFilters);
  };

  const handleDownload = async () => {
    if (!data || data.length === 0) {
      toast.error("No hay datos para descargar");
      return;
    }

    try {
      const filename = generateFilename(filters, downloadFormat);
      if (downloadFormat === "csv") {
        downloadAsCSV(data, filename, filters.integration);
        toast.success(
          `Archivo ${downloadFormat.toUpperCase()} descargado exitosamente`,
        );
      } else if (downloadFormat === "xlsx") {
        await downloadAsExcel(data, filename, filters.integration);
        toast.success(
          `Archivo ${downloadFormat.toUpperCase()} descargado exitosamente`,
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al descargar el archivo";
      toast.error(errorMessage);
    }
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
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center p-2">
            <div className="flex gap-2 border border-primary/20 p-2 rounded-md">
              <Button
                onClick={handleDownload}
                className="btn btn-primary text-primary bg-secondary hover:bg-secondary/90 hover:shadow-primary active:shadow-none active:scale-99 cursor-pointer select-none transition-all"
              >
                <FileDown className="w-4 h-4" />
                Guardar Archivo
              </Button>
              <Select
                value={downloadFormat}
                onValueChange={(value: "csv" | "xlsx") =>
                  setDownloadFormat(value)
                }
              >
                <SelectTrigger id="download-format" className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Table data={data} />
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
        <div className="w-full flex flex-col items-center justify-center text-center">
          <Image
            src="/data_download.png"
            alt="No hay datos"
            width={450}
            height={450}
          />
        </div>
      )}
    </div>
  );
}
