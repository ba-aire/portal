"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { etiquetaHora, HORAS_DESDE, HORAS_HASTA } from "@/lib/rango-minutal";

interface HourRangeSelectProps {
  startHour: number;
  endHour: number;
  disabled?: boolean;
  onChange: (key: "startHour" | "endHour", value: number) => void;
}

/** Franja horaria de un día: lo que acompaña al selector de día en los minutales. */
export default function HourRangeSelect({
  startHour,
  endHour,
  disabled,
  onChange,
}: HourRangeSelectProps) {
  return (
    <>
      <div className="flex flex-col gap-3">
        <Label htmlFor="startHour" className="px-1">
          Hora desde
        </Label>
        <Select
          name="startHour"
          value={String(startHour)}
          onValueChange={(value) => onChange("startHour", Number(value))}
          disabled={disabled}
        >
          <SelectTrigger id="startHour" className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HORAS_DESDE.map((hora) => (
              <SelectItem key={hora} value={String(hora)}>
                {etiquetaHora(hora)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-3">
        <Label htmlFor="endHour" className="px-1">
          Hora hasta
        </Label>
        <Select
          name="endHour"
          value={String(endHour)}
          onValueChange={(value) => onChange("endHour", Number(value))}
          disabled={disabled}
        >
          <SelectTrigger id="endHour" className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HORAS_HASTA.map((hora) => (
              <SelectItem key={hora} value={String(hora)}>
                {etiquetaHora(hora)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
