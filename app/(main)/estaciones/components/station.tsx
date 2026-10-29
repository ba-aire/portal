"use client";

import { AlertCircle, Loader2, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import useSSE from "@/hooks/useSSE";
import type { FullLocationData } from "@/lib/location/models";
import { cn } from "@/lib/utils";
import DataGrid from "./data-grid";

function toTitle(location: string) {
  if (!location) return "Estación";
  if (location === "catalinas") return "La Boca";
  return `${location}`;
}

const getLocationBgColor = (location: string) => {
  switch (location) {
    case "catalinas":
      return "bg-catalinas";
    case "cordoba":
      return "bg-cordoba";
    case "cifa":
      return "bg-cifa";
    case "centenario":
      return "bg-centenario";
    default:
      return "bg-otra";
  }
};

export default function Station({ location }: { location: string }) {
  const { data, error, status } = useSSE<FullLocationData>(`/api/${location}`);
  const bgColor = getLocationBgColor(location);
  return (
    <div className="w-full h-full p-6 flex flex-col max-w-7xl mx-auto">
      <div className="flex items-center relative gap-3">
        <div className={cn(`w-1 h-6 rounded-full`, bgColor)} />
        <h1 className="text-2xl font-bold text-primary relative z-10 uppercase tracking-wider">
          Estación {toTitle(location)}
        </h1>
      </div>

      {/* Estado desconectado */}
      {status === "closed" && !data && (
        <Card className="bg-white/95 backdrop-blur-xs border-border/60">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="p-6 bg-muted/50 rounded-full">
              <WifiOff className="w-16 h-16 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold text-muted-foreground mb-3">
              No conectado
            </h3>
          </CardContent>
        </Card>
      )}

      {/* Estado conectando */}
      {status === "connecting" && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
          <div className="p-6 bg-primary/10 rounded-full mb-6">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
          </div>
          <h3 className="text-2xl font-bold text-primary mb-3">
            Conectando...
          </h3>
        </div>
      )}

      {/* Estado de error */}
      {error && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
          <div className="p-6 bg-destructive/10 rounded-full mb-6 shadow-lg">
            <AlertCircle className="w-16 h-16 text-destructive" />
          </div>
          <h3 className="text-2xl font-bold text-destructive mb-3">
            Error de conexión
          </h3>
          <p className="text-destructive/80 mb-6 max-w-lg text-lg">{error}</p>
        </div>
      )}

      {/* Estado conectado y con datos */}
      {status === "open" && data && <DataGrid data={data} />}
    </div>
  );
}
