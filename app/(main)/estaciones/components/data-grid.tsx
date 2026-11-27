import { Calendar, Clock, Droplets, Thermometer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FullLocationData, Status } from "@/lib/location/models";
import { cn } from "@/lib/utils";
import { contaminantes, meteorologica } from "./items";
import CardCabina from "./ui/card-cabina";

// Valor de una tarjeta: coma decimal y siempre la misma cantidad de decimales
// por variable; "s/d" si no hay dato (como en el resto del portal).
function formatoValor(
  valor: string | number | null | undefined,
  decimales: number,
): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (n == null || !Number.isFinite(n)) return "s/d";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

// Sin dato, sin unidad: "s/d" y no "s/d °C".
const conUnidad = (texto: string, unidad: string) =>
  texto === "s/d" ? texto : `${texto} ${unidad}`;

export default function DataGrid({ data }: { data: FullLocationData }) {
  const getStatusColor = (status: Status) => {
    switch (status) {
      case "k":
        return "text-status-k";
      case "a":
        return "text-status-a";
      case "v":
        return "text-status-v";
      case "m":
        return "text-status-m";
      case "z":
        return "text-status-m";
      case "s":
        return "text-status-m";
      case "c":
        return "text-status-a";
      case "av":
        return "text-status-av";
      case "mv":
        return "text-status-mv";
      default:
        return "";
    }
  };
  const getStatusText = (status: Status) => {
    switch (status) {
      case "k":
        return "OK";
      case "a":
        return "Alarma equipo";
      case "v":
        return "Valor erróneo";
      case "m":
        return "Mantenimiento";
      case "z":
        return "Zero cal";
      case "s":
        return "Span cal";
      case "c":
        return "Error de conexión";
      case "av":
        return "Alarma";
      case "mv":
        return "Mantenimiento";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col">
      <header className="flex flex-col w-full gap-5 lg:gap-28 md:flex-row pb-6 items-center my-6 border-b border-primary/30 text-sm text-muted-foreground">
        {/* Condiciones de cabina */}
        <div className="flex gap-4">
          <CardCabina
            label="Temperatura Cabina"
            icon={<Thermometer className="w-4 h-4 text-primary" />}
            value={conUnidad(formatoValor(data.temp_in_mean, 1), "°C")}
          />
          <CardCabina
            label="Humedad Cabina"
            icon={<Droplets className="w-4 h-4 text-primary " />}
            value={conUnidad(formatoValor(data.hr_in_mean, 0), "%")}
          />
        </div>
        {/* Fecha y hora actualizacion*/}
        <div className="flex flex-col gap-2">
          <span className="font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {data.latest_time
              ? new Date(data.latest_time).toLocaleDateString("es-AR", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "Fecha no disponible"}
          </span>
          <span className="font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Última actualización:{" "}
            {data.latest_time
              ? new Intl.DateTimeFormat("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).format(new Date(data.latest_time))
              : "N/A"}
          </span>
        </div>
      </header>

      {/* Contaminantes Title */}
      <section className="my-6 space-y-4" aria-label="Contaminantes">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-primary" />
          <h2 className="text-lg font-bold text-foreground uppercase tracking-wider sm:text-xl">
            Contaminantes
          </h2>
        </div>
        {/* Grid Contaminantes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {contaminantes.map((contaminante) => {
            const value = data[contaminante.key];
            // Si el contaminante es NO o NO₂, se usa el status de NOX (son datos del mismo analizador)
            const status =
              contaminante.key === "no2_mean" || contaminante.key === "no_mean"
                ? data[`nox_mean_status` as keyof FullLocationData]
                : data[`${contaminante.key}_status` as keyof FullLocationData];
            const statusColor = getStatusColor(status as Status);

            return (
              <Card
                key={contaminante.key}
                className={cn(
                  "relative p-5 overflow-hidden border border-border/40 backdrop-blur-3xl bg-gradient-to-br from-primary to-primary/90 transition-all duration-300 hover:shadow-md shadow-sm shadow-black/30",
                  status == null ? "hidden" : "",
                  value == null
                    ? "brightness-90 text-primary-foreground/60"
                    : "border-border/60 text-primary-foreground/80",
                )}
              >
                <CardHeader className="p-0">
                  <div className="flex items-center justify-between text-base font-bold">
                    <span>{contaminante.nombre}</span>
                    <span className="text-sm">({contaminante.unidad})</span>
                  </div>
                </CardHeader>
                <CardContent className="py-3 px-0">
                  <div
                    className={cn(
                      "text-3xl font-bold transition-all p-2",
                      statusColor,
                    )}
                  >
                    {formatoValor(value, contaminante.decimales)}
                  </div>
                </CardContent>

                <div className="text-xs leading-tight flex items-center">
                  <span className="font-bold text-xs">
                    Estado:
                    <span
                      className={cn(
                        "text-xs font-bold rounded-full",
                        statusColor,
                      )}
                    >
                      {" "}
                      {getStatusText(status as Status)}
                    </span>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Meteorologica Title */}
      <section className="my-6 space-y-4" aria-label="Meteorológica">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-primary" />
          <h2 className="text-lg font-semibold text-foreground uppercase tracking-wider sm:text-xl">
            Meteorológica
          </h2>
        </div>
        {/* Grid Meteorológica */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {meteorologica.map((meteo) => {
            const IconComponent = meteo.icon;
            const value = data[meteo.key];
            return (
              <Card
                key={meteo.key}
                className="relative py-3 px-5 overflow-hidden border border-primary/60 bg-gradient-to-br from-secondary/20 to-secondary/50 backdrop-blur-sm transition-all duration-300 hover:shadow-md shadow-sm shadow-black/30"
              >
                <CardTitle className="text-sm font-semibold text-primary">
                  {meteo.nombre}
                </CardTitle>
                <CardContent className="p-0 my-1 flex justify-between items-center text-primary/80">
                  <IconComponent className="w-5 h-5" />
                  <div
                    className={cn(
                      "text-xl font-bold transition-colors",
                      value == null ? "text-primary/70" : "text-primary",
                    )}
                  >
                    {formatoValor(value, meteo.decimales)}{" "}
                    <span className="text-xs">{meteo.unidad}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
