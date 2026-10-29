"use client";

import { ChevronDownIcon, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filtrosSchema } from "@/lib/datos/models";

export interface FiltrosType {
  metrica: string;
  interval: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  locations: string;
}

export const contaminantesOptions = [
  { label: "CO", value: "co" },
  { label: "NO2 Solo", value: "no2" },
  { label: "NOx Totales", value: "nox" },
  { label: "PM10", value: "pm10" },
  { label: "PM2.5", value: "pm25" },
  { label: "PM10 y 2.5", value: "pm1025" },
  { label: "O3", value: "o3" },
  { label: "SO2", value: "so2" },
];

export const promedioOptions = [
  { label: "Minutos", value: "minute" },
  { label: "Horas", value: "hour" },
  { label: "Días", value: "day" },
];

export const locationsOptions = [
  { label: "Centenario", value: "centenario" },
  { label: "La Boca", value: "catalinas" },
  { label: "Cordoba", value: "cordoba" },
  { label: "Cifa", value: "cifa" },
];

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
  const [openLocations, setOpenLocations] = useState(false);

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

  // Helpers para manejar selección múltiple de estaciones
  const selectedLocations = (localFilters.locations || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleLocation = (loc: string, checked: boolean) => {
    const set = new Set(selectedLocations);
    if (checked) {
      set.add(loc);
    } else {
      set.delete(loc);
    }
    const joined = Array.from(set).join(",");
    handleChange("locations", joined);
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
      metrica: localFilters.metrica,
      interval: localFilters.interval,
      startDate:
        typeof localFilters.startDate === "string"
          ? new Date(localFilters.startDate)
          : localFilters.startDate,
      endDate:
        typeof localFilters.endDate === "string"
          ? new Date(localFilters.endDate)
          : localFilters.endDate,
      locations: localFilters.locations,
    } as const;
    if (onFetch) onFetch(filtersToSend);

    // Actualizar URL solo con valores presentes
    const params = new URLSearchParams();
    params.set("metrica", localFilters.metrica);
    params.set("interval", localFilters.interval ?? "");
    if (filtersToSend.startDate) {
      params.set("startDate", filtersToSend.startDate.toISOString());
    }
    if (filtersToSend.endDate) {
      params.set("endDate", filtersToSend.endDate.toISOString());
    }
    if ((localFilters.locations || "").trim()) {
      params.set("locations", localFilters.locations);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="p-2">
      <header className="mb-10">
        <h1 className="text-2xl font-bold text-primary text-center relative z-10 uppercase tracking-wider mb-2">
          Datos de Calidad del Aire
        </h1>
        <h2 className="text-primary/70 text-center font-semibold">
          Seleccioná el contaminante, el tipo de integración y el rango de
          fechas para consultar los datos.
        </h2>
      </header>
      <div className="flex flex-col flex-wrap md:flex-row gap-4 items-center justify-center text-primary">
        {/* Select contaminante (metrica) */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="metrica" className="px-1">
            Métrica
          </Label>
          <Select
            name="metrica"
            value={localFilters.metrica}
            onValueChange={(value) => handleChange("metrica", value)}
            disabled={isLoading}
          >
            <SelectTrigger id="metrica" className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contaminantesOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Select promedio (minutal, horario, diario) */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="interval" className="px-1">
            Integración
          </Label>
          <Select
            name="interval"
            value={localFilters.interval ?? ""}
            onValueChange={(value) => handleChange("interval", value)}
            disabled={isLoading}
          >
            <SelectTrigger id="interval" className="w-[180px]">
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

        {/* Select locations con selección múltiple (checkboxes) */}
        {/* Si metrica es NOx, permite seleccionar solo 1 estación */}
        <div className="flex flex-col gap-3">
          <Label htmlFor="locations" className="px-1">
            Estaciones
          </Label>
          <Popover open={openLocations} onOpenChange={setOpenLocations}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                id="locations"
                className="w-[220px] justify-between font-normal"
                disabled={isLoading}
              >
                {selectedLocations.length > 0
                  ? `${selectedLocations.length} seleccionada$${""}`.replace(
                      "$",
                      selectedLocations.length === 1 ? "" : "s",
                    )
                  : "Elegir estaciones"}
                <ChevronDownIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-2" align="start">
              <div className="flex flex-col gap-2 max-h-64 overflow-auto">
                {locationsOptions.map((opt) => {
                  const checked = selectedLocations.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      htmlFor={`loc-${opt.value}`}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(val) =>
                          toggleLocation(opt.value, Boolean(val))
                        }
                        id={`loc-${opt.value}`}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
              <SelectSeparator className="my-2" />
              <div className="text-xs text-primary">
                Para métrica &quot;NOx Totales&quot; seleccionar una sola
                estación
              </div>
            </PopoverContent>
          </Popover>
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
                id="startDate"
                name="startDate"
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
                id="endDate"
                name="endDate"
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
