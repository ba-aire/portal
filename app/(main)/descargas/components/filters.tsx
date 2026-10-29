"use client";

import { ChevronDownIcon, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filtrosSchema } from "@/lib/descargas/models";

export const promedioOptions = [
  { label: "Minutales", value: "minute" },
  { label: "Horarios", value: "hour" },
];

export const locationOptions = [
  { label: "Centenario", value: "centenario" },
  { label: "La Boca", value: "catalinas" },
  { label: "Cordoba", value: "cordoba" },
  { label: "Cifa", value: "cifa" },
];

export interface FiltrosType {
  location: "centenario" | "catalinas" | "cordoba" | "cifa";
  integration: "hour" | "minute";
  startDate: Date | undefined;
  endDate: Date | undefined;
}

interface FiltrosProps {
  currentFilters: FiltrosType;
  isLoading?: boolean;
  onFetch?: (filters: FiltrosType) => void;
}

export default function Filtros({
  currentFilters,
  isLoading = false,
  onFetch,
}: FiltrosProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Estado local para los selects
  const [localFilters, setLocalFilters] = useState(currentFilters);
  // (no local inline errors; usamos toasts para notificar)
  // Estado para popup de date pickers
  const [openStartDate, setOpenStartDate] = useState(false);
  const [openEndDate, setOpenEndDate] = useState(false);

  // Helper que formatea la fecha para la UI: 'lun, dd/mm/yyyy'
  const formatDateUI = (date: string | Date | undefined) => {
    if (!date) return "Elegir Fecha";
    const d = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return "Elegir Fecha";
    return d.toLocaleDateString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Setter genérico de cambios locales y limpieza de errores del campo
  const handleChange = (key: string, value: unknown) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Valida usando Zod y devuelve un objeto con errores por campo (no muta estado)
  const validateFilters = (): Record<string, string> => {
    try {
      filtrosSchema.parse(localFilters as unknown);
      return {};
    } catch (err) {
      if (err instanceof z.ZodError) {
        const nextErrors: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path[0] as string | undefined;
          if (key && !nextErrors[key]) {
            nextErrors[key] = issue.message;
          }
        }
        return nextErrors;
      }
      throw err;
    }
  };

  const handleApply = () => {
    // Validación cliente
    const nextErrors = validateFilters();
    if (Object.keys(nextErrors).length > 0) {
      // Mostrar toasts de error (máx. 3)
      Object.values(nextErrors)
        .slice(0, 3)
        .forEach((m) => {
          toast.error(m);
        });
      return;
    }

    // Enviar filtros ya validados
    const filtersToSend = {
      integration: localFilters.integration,
      startDate:
        typeof localFilters.startDate === "string"
          ? new Date(localFilters.startDate)
          : localFilters.startDate,
      endDate:
        typeof localFilters.endDate === "string"
          ? new Date(localFilters.endDate)
          : localFilters.endDate,
      location: localFilters.location,
    } as const;
    if (onFetch) onFetch(filtersToSend);

    // Actualizar URL solo con valores presentes
    const params = new URLSearchParams();
    params.set("integration", localFilters.integration ?? "");
    if (filtersToSend.startDate) {
      params.set("startDate", filtersToSend.startDate.toISOString());
    }
    if (filtersToSend.endDate) {
      params.set("endDate", filtersToSend.endDate.toISOString());
    }
    if ((localFilters.location || "").trim()) {
      params.set("location", localFilters.location);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="p-2">
      <header className="mb-10">
        <h1 className="text-2xl font-bold text-primary text-center relative z-10 uppercase tracking-wider mb-2">
          Red de Calidad del Aire
        </h1>
        <h3 className="text-primary/70 text-center font-semibold">
          Seleccioná estación, integración y rango de fechas para descargar los
          datos.
        </h3>
      </header>
      <div className="flex flex-col flex-wrap md:flex-row gap-4 items-center justify-center text-primary">
        {/* Select location */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="location" className="px-1">
            Estación
          </Label>
          <Select
            name="location"
            value={localFilters.location ?? "centenario"}
            onValueChange={(value) => handleChange("location", value)}
            disabled={isLoading}
          >
            <SelectTrigger id="location" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locationOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Select promedio (minutal, horario) */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="integration" className="px-1">
            Integración
          </Label>
          <Select
            name="integration"
            value={localFilters.integration ?? ""}
            onValueChange={(value) => handleChange("integration", value)}
            disabled={isLoading}
          >
            <SelectTrigger id="integration" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {promedioOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* start date date picker */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="startDate" className="px-1">
            Desde
          </Label>
          <Popover open={openStartDate} onOpenChange={setOpenStartDate}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                name="startDate"
                id="startDate"
                className="w-48 justify-between font-normal"
              >
                {formatDateUI(localFilters.startDate)}
                <ChevronDownIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden p-0"
              align="start"
            >
              <Calendar
                mode="single"
                selected={
                  localFilters.startDate
                    ? new Date(localFilters.startDate)
                    : undefined
                }
                captionLayout="dropdown"
                onSelect={(date) => {
                  handleChange("startDate", date);
                  setOpenStartDate(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* endDate date picker */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="endDate" className="px-1">
            Hasta
          </Label>
          <Popover open={openEndDate} onOpenChange={setOpenEndDate}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                name="endDate"
                id="endDate"
                className="w-48 justify-between font-normal"
              >
                {formatDateUI(localFilters.endDate)}
                <ChevronDownIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden p-0"
              align="start"
            >
              <Calendar
                mode="single"
                selected={
                  localFilters.endDate
                    ? new Date(localFilters.endDate)
                    : undefined
                }
                captionLayout="dropdown"
                onSelect={(date) => {
                  handleChange("endDate", date);
                  setOpenEndDate(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <Button
          className="btn btn-primary text-primary bg-secondary hover:bg-secondary/90 hover:shadow-primary active:shadow-none active:scale-99 mt-auto cursor-pointer select-none transition-all"
          onClick={handleApply}
          disabled={isLoading}
        >
          <Search className="w-4 h-4" />
          Buscar Datos
        </Button>
      </div>
    </div>
  );
}
