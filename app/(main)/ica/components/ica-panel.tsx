"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import useFetchIca, { precargarIca } from "@/hooks/useFetchIca";
import {
  type IcaCiudad,
  type IcaRespuesta,
  INDICES,
  type Indice,
  IndiceEnum,
} from "@/lib/ica/models";
import {
  etiquetaDeHora,
  franjaHoraria,
  horasDelSelector,
  horasDistintas,
} from "@/lib/ica/presentacion";
import { cn } from "@/lib/utils";
import { Etiqueta } from "./etiqueta";
import { Leyenda } from "./leyenda";
import IcaMap from "./map";
import { SelectorHora } from "./selector-hora";

// Cuánto se queda cada hora en pantalla al reproducir. Cuenta desde que llegó
// el dato, no desde que se pidió: con la base lenta, no se saltea ninguna.
const PASO_MS = 1000;

// Al arrastrar el deslizador se pide la hora donde se suelta, no cada una por
// la que pasa.
const ESPERA_MS = 250;

function TarjetaCiudad({
  ciudad,
  enHora,
  className,
}: {
  ciudad: IcaCiudad | null;
  enHora: boolean;
  className?: string;
}) {
  const franja = franjaHoraria(ciudad?.ts_hour ?? null);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-primary/30 bg-white px-4 py-3 shadow-sm transition-opacity",
        className,
      )}
    >
      <span className="text-sm font-semibold text-primary">
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
            índice{franja && ` · ${franja}`}
          </span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">
          {enHora ? "Sin índice a esa hora" : "Sin índice en las últimas horas"}
        </span>
      )}
    </div>
  );
}

/** Qué es "Última hora" con lo que llegó: cada estación trae la suya. */
function detalleUltima(datos: IcaRespuesta | null): string {
  if (!datos) return "Cargando…";
  const horas = horasDistintas(datos.estaciones);
  if (horas.length === 0) return "Sin índice en las últimas 6 horas";
  if (horas.length === 1) return etiquetaDeHora(horas[0]) ?? "";
  return "Cada estación con su última hora";
}

/** La hora actual, al minuto: corre el deslizador cuando empieza otra hora. */
function useAhora() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 60 * 1000);
    return () => clearInterval(intervalo);
  }, []);
  return ahora;
}

export default function IcaPanel() {
  const [indice, setIndice] = useState<Indice>("EPA");
  // null = la última hora de cada estación (lo que se ve al entrar).
  const [hora, setHora] = useState<string | null>(null);
  const [horaPedida, setHoraPedida] = useState<string | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const ahora = useAhora();
  const horas = useMemo(() => horasDelSelector(ahora), [ahora]);

  useEffect(() => {
    const espera = setTimeout(() => setHoraPedida(hora), ESPERA_MS);
    return () => clearTimeout(espera);
  }, [hora]);

  const { data, error, isLoading } = useFetchIca(indice, horaPedida);
  // Las categorías de un índice no significan lo mismo en el otro: mientras
  // llega el índice nuevo no se muestra nada del anterior.
  const datos = data?.indice === indice ? data : null;
  // La de otra hora sí se deja, atenuada, para que el mapa no parpadee al
  // mover el deslizador.
  const alDia = datos !== null && datos.hora === hora;

  // Una hora que quedó fuera del deslizador (pasó otra hora con la página
  // abierta) se corre a la más vieja que sigue adentro.
  useEffect(() => {
    if (hora !== null && !horas.includes(hora)) setHora(horas[0]);
  }, [hora, horas]);

  // Reproducir: con el dato de esta hora en pantalla, espera PASO_MS y pasa a
  // la siguiente, que se pide por adelantado. Termina en "Última hora".
  useEffect(() => {
    if (!reproduciendo || !alDia) return;
    if (hora === null) {
      setReproduciendo(false);
      return;
    }
    const i = horas.indexOf(hora);
    const siguiente = i + 1 < horas.length ? horas[i + 1] : null;
    if (siguiente) precargarIca(indice, siguiente);
    const paso = setTimeout(() => setHora(siguiente), PASO_MS);
    return () => clearTimeout(paso);
  }, [reproduciendo, alDia, hora, horas, indice]);

  // Con un error la hora no llega nunca y la reproducción quedaría trabada.
  useEffect(() => {
    if (error) setReproduciendo(false);
  }, [error]);

  const enHora = hora !== null;

  return (
    <div className="flex h-full w-full flex-col gap-3 p-3 sm:p-4">
      <PageHeader
        title="Índice de calidad del aire"
        description={INDICES[indice].descripcion}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {/* El mapa queda montado aunque cambie el índice o la hora: solo cambian
          los marcadores. Desde sm, los controles flotan encima, como en el
          visor de la EEA: el índice y la Ciudad arriba a la izquierda, la hora
          arriba a la derecha y la escala abajo a la izquierda. En un teléfono
          taparían las estaciones, así que van arriba y abajo del mapa. */}
      <div className="flex flex-1 flex-col gap-3 sm:relative sm:min-h-[480px] sm:overflow-hidden sm:rounded-lg sm:border sm:border-primary/30">
        {/* pointer-events-none en la franja: entre las tarjetas el mapa se
            sigue pudiendo arrastrar y clickear. */}
        <div className="flex flex-col gap-3 sm:pointer-events-none sm:absolute sm:inset-x-3 sm:top-3 sm:z-10 sm:flex-row sm:items-start">
          <div className="flex flex-wrap items-stretch gap-3 sm:min-w-0 sm:flex-1">
            {/* Los dos índices no se mezclan: se elige uno y toda la pantalla
                (colores, categorías, leyenda) es de ese. */}
            <fieldset className="pointer-events-auto flex items-center gap-1 rounded-lg border border-primary/30 bg-white p-1 shadow-sm sm:border-primary/15 sm:shadow-md sm:shadow-black/15">
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

            {/* Sobre el mapa la tarjeta mide lo que su texto, no se estira
                hasta el selector de hora: si no entra al lado del índice,
                baja a la línea siguiente. */}
            {datos ? (
              <TarjetaCiudad
                ciudad={datos.ciudad}
                enHora={enHora}
                className={cn(
                  "pointer-events-auto min-w-64 flex-1 sm:flex-initial sm:border-primary/15 sm:shadow-md sm:shadow-black/15",
                  !alDia && "opacity-50",
                )}
              />
            ) : (
              <div className="pointer-events-auto flex min-w-64 flex-1 items-center rounded-lg border border-primary/30 bg-white px-4 py-3 text-sm text-muted-foreground shadow-sm sm:flex-initial sm:border-primary/15 sm:shadow-md sm:shadow-black/15">
                {error ? "Sin datos" : "Cargando…"}
              </div>
            )}
          </div>

          <SelectorHora
            horas={horas}
            hora={hora}
            onCambiar={setHora}
            reproduciendo={reproduciendo}
            onReproducir={setReproduciendo}
            ahora={ahora}
            cargando={isLoading && datos !== null}
            detalleUltima={detalleUltima(hora === null && alDia ? datos : null)}
            className="pointer-events-auto sm:w-80 sm:shrink-0"
          />
        </div>

        <div className="relative h-[360px] overflow-hidden rounded-lg border border-primary/30 sm:absolute sm:inset-0 sm:h-auto sm:rounded-none sm:border-0">
          <IcaMap
            estaciones={datos?.estaciones ?? []}
            categorias={datos?.categorias ?? []}
            enHora={enHora}
            atenuado={!alDia}
          />
          {!datos && isLoading && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-10 animate-spin text-primary" />
            </div>
          )}
        </div>

        {datos && datos.categorias.length > 0 && (
          <Leyenda
            indice={indice}
            categorias={datos.categorias}
            className="sm:absolute sm:bottom-3 sm:left-3 sm:z-10 sm:w-max"
          />
        )}
      </div>
    </div>
  );
}
