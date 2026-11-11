"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import useFetchIca from "@/hooks/useFetchIca";
import {
  type IcaCategoria,
  type IcaCiudad,
  type IcaEstacion,
  INDICES,
  type Indice,
  IndiceEnum,
} from "@/lib/ica/models";
import {
  COLOR_SIN_DATO,
  colorDeTexto,
  franjaHoraria,
  tipoDeEstacion,
} from "@/lib/ica/presentacion";
import IcaMap from "./map";

function Etiqueta({
  color,
  children,
}: {
  color: string | null;
  children: React.ReactNode;
}) {
  const fondo = color ?? COLOR_SIN_DATO;
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold"
      style={{ backgroundColor: fondo, color: colorDeTexto(fondo) }}
    >
      {children}
    </span>
  );
}

function TarjetaCiudad({ ciudad }: { ciudad: IcaCiudad | null }) {
  return (
    <Card className="border-primary/30">
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
        <span className="text-sm font-medium text-primary/80">
          Ciudad de Buenos Aires
        </span>
        {ciudad ? (
          <>
            <Etiqueta color={ciudad.color_hex}>
              {ciudad.categoria_nombre}
              {ciudad.valor !== null && ` · ${ciudad.valor}`}
            </Etiqueta>
            {/* El índice de la Ciudad es el de la peor estación, no un promedio:
                se dice cuál es para que no se lea como un valor de toda la Ciudad. */}
            <span className="text-sm text-muted-foreground">
              Peor estación: {ciudad.station_name}, de {ciudad.n_estaciones} con
              índice
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            Sin índice en las últimas horas
          </span>
        )}
      </CardContent>
    </Card>
  );
}

function TarjetaEstacion({
  estacion,
  categorias,
}: {
  estacion: IcaEstacion;
  categorias: IcaCategoria[];
}) {
  const colorDe = (categoria: number) =>
    categorias.find((c) => c.categoria === categoria)?.color_hex ?? null;
  const tipo = tipoDeEstacion(estacion.station_type);

  return (
    <Card className="border-primary/30">
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold text-primary">
            {estacion.station_name}
          </span>
          {tipo && (
            <span className="text-xs text-muted-foreground">{tipo}</span>
          )}
        </div>

        {estacion.categoria === null ? (
          <span className="text-sm text-muted-foreground">
            Sin índice en las últimas horas
          </span>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Etiqueta color={estacion.color_hex}>
                {estacion.categoria_nombre}
                {estacion.valor !== null && ` · ${estacion.valor}`}
              </Etiqueta>
              <span className="text-xs text-muted-foreground">
                {franjaHoraria(estacion.ts_hour)}
              </span>
            </div>

            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {estacion.contaminantes.map((c) => (
                <li key={c.parameter_code} className="flex items-center gap-1">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 rounded-full border border-black/20"
                    style={{
                      backgroundColor: colorDe(c.categoria) ?? COLOR_SIN_DATO,
                    }}
                  />
                  <span>{c.nombre}</span>
                  {c.subindice !== null && (
                    <span className="text-muted-foreground">{c.subindice}</span>
                  )}
                </li>
              ))}
            </ul>

            {/* Una estación que mide menos contaminantes da un índice "mejor"
                solo por eso. data lo marca y acá se dice. */}
            {estacion.indice_completo === false && (
              <span className="text-xs text-amber-700">
                Índice incompleto: faltan contaminantes para este tipo de
                estación.
              </span>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Leyenda({ categorias }: { categorias: IcaCategoria[] }) {
  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {categorias.map((c) => (
        <li key={c.categoria}>
          <Etiqueta color={c.color_hex}>{c.nombre}</Etiqueta>
        </li>
      ))}
    </ul>
  );
}

export default function IcaPanel() {
  const [indice, setIndice] = useState<Indice>("EPA");
  const { data, error, isLoading } = useFetchIca(indice);

  return (
    <div className="flex h-full w-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight text-primary">
            Índice de calidad del aire
          </h2>
          <p className="text-sm text-muted-foreground">
            {INDICES[indice].descripcion}
          </p>
        </div>

        {/* Los dos índices no se mezclan: se elige uno y toda la pantalla
            (colores, categorías, leyenda) es de ese. */}
        <fieldset className="flex gap-1 rounded-md border border-primary/30 p-1">
          <legend className="sr-only">Índice</legend>
          {IndiceEnum.options.map((opcion) => (
            <Button
              key={opcion}
              type="button"
              size="sm"
              variant={opcion === indice ? "default" : "ghost"}
              aria-pressed={opcion === indice}
              onClick={() => setIndice(opcion)}
            >
              {INDICES[opcion].nombre}
            </Button>
          ))}
        </fieldset>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {isLoading && !data && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-10 animate-spin text-primary" />
        </div>
      )}

      {data && (
        <>
          <TarjetaCiudad ciudad={data.ciudad} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.estaciones.map((e) => (
              <TarjetaEstacion
                key={e.station_code}
                estacion={e}
                categorias={data.categorias}
              />
            ))}
          </div>
          <Leyenda categorias={data.categorias} />
          <div className="min-h-[360px] flex-1 overflow-hidden rounded-md border border-primary/30">
            <IcaMap estaciones={data.estaciones} />
          </div>
        </>
      )}
    </div>
  );
}
