"use client";

import { AlertCircle, Loader2, WifiOff } from "lucide-react";
import {
  ESCALA_ESTADO,
  ESCALA_ESTADO_MENSAJE,
  ESCALA_TITULO,
} from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import useSSE from "@/hooks/useSSE";
import { withBasePath } from "@/lib/base-path";
import { claseFondoEstacion, nombreEstacion } from "@/lib/estaciones";
import type { FullLocationData } from "@/lib/location/models";
import { cn } from "@/lib/utils";
import DataGrid from "./data-grid";

export default function Station({ location }: { location: string }) {
  const { data, error, status } = useSSE<FullLocationData>(
    withBasePath(`/api/${location}`),
  );
  const bgColor = claseFondoEstacion(location);
  return (
    <div className="w-full h-full p-6 flex flex-col max-w-7xl mx-auto">
      <div className="flex items-center relative gap-3">
        <div className={cn(`w-1 h-6 rounded-full`, bgColor)} />
        <h1
          className={cn(
            "font-bold text-primary relative z-10 uppercase tracking-wider",
            ESCALA_TITULO,
          )}
        >
          Estación {nombreEstacion(location)}
        </h1>
      </div>

      {/* Estado desconectado */}
      {status === "closed" && !data && (
        <Card className="bg-white/95 backdrop-blur-xs border-border/60">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="p-6 bg-muted/50 rounded-full">
              <WifiOff className="w-16 h-16 text-muted-foreground" />
            </div>
            <h3
              className={cn(
                "font-bold text-muted-foreground mb-3",
                ESCALA_ESTADO,
              )}
            >
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
          <h3 className={cn("font-bold text-primary mb-3", ESCALA_ESTADO)}>
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
          <h3 className={cn("font-bold text-destructive mb-3", ESCALA_ESTADO)}>
            Error de conexión
          </h3>
          <p
            className={cn(
              "text-destructive/80 mb-6 max-w-lg",
              ESCALA_ESTADO_MENSAJE,
            )}
          >
            {error}
          </p>
        </div>
      )}

      {/* Estado conectado y con datos */}
      {status === "open" && data && <DataGrid data={data} />}
    </div>
  );
}
