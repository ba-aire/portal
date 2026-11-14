"use client";

import type { StyleSpecification } from "maplibre-gl";
import { useState } from "react";
// biome-ignore lint/suspicious/noShadowRestrictedNames: "Map" es el nombre del componente de react-map-gl
import Map, { Marker, Popup } from "react-map-gl/maplibre";
import type { IcaEstacion } from "@/lib/ica/models";
import {
  COLOR_SIN_DATO,
  colorDeTexto,
  franjaHoraria,
} from "@/lib/ica/presentacion";

// El mapa es CONTEXTO: dónde está cada estación. Lo que informa son los
// marcadores, así que el fondo va en gris y apagado para que los colores del
// índice sean lo único con color en la pantalla.
//
// Siguen siendo las teselas raster de OpenStreetMap, sin saturación y aclaradas.
// Un estilo vectorial pide elegir un proveedor de teselas (o servirlas desde la
// VM) y sumarlo al CSP de proxy.ts; con esto no cambia ningún tercero.
const ESTILO: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: {
        "raster-saturation": -1,
        "raster-contrast": -0.15,
        "raster-brightness-min": 0.25,
        "raster-opacity": 0.85,
      },
    },
  ],
};

// El centro de la Ciudad, para ver las cuatro estaciones sin mover el mapa.
const VISTA_INICIAL = { longitude: -58.42, latitude: -34.63, zoom: 11 };

export default function IcaMap({ estaciones }: { estaciones: IcaEstacion[] }) {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);

  // Una estación sin coordenadas en dim.stations no se dibuja: no se inventa
  // una posición.
  const ubicadas = estaciones.filter(
    (e): e is IcaEstacion & { latitude: number; longitude: number } =>
      e.latitude !== null && e.longitude !== null,
  );
  const activa = ubicadas.find((e) => e.station_code === seleccionada);

  return (
    <Map initialViewState={VISTA_INICIAL} mapStyle={ESTILO}>
      {ubicadas.map((e) => {
        const fondo = e.color_hex ?? COLOR_SIN_DATO;
        return (
          <Marker
            key={e.station_code}
            latitude={e.latitude}
            longitude={e.longitude}
            anchor="center"
            onClick={(evento) => {
              // Sin esto el clic llega al mapa, que cierra el popup recién abierto.
              evento.originalEvent.stopPropagation();
              setSeleccionada(e.station_code);
            }}
          >
            <button
              type="button"
              aria-label={`${e.station_name}: ${e.categoria_nombre ?? "sin índice"}`}
              className="flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-full border-2 border-white px-2 text-sm font-bold shadow-md shadow-black/40"
              style={{
                backgroundColor: fondo,
                color: colorDeTexto(fondo),
                // Índice incompleto: borde punteado, como el círculo
                // semitransparente del visor de la EEA.
                borderStyle: e.indice_completo === false ? "dashed" : "solid",
              }}
            >
              {e.valor ?? (e.categoria === null ? "–" : "")}
            </button>
          </Marker>
        );
      })}

      {activa && (
        <Popup
          latitude={activa.latitude}
          longitude={activa.longitude}
          closeOnClick
          onClose={() => setSeleccionada(null)}
          anchor="top"
          offset={18}
          maxWidth="280px"
        >
          <div className="flex flex-col gap-1 text-sm text-gray-900">
            {/* pr-6: el nombre no se mete debajo del botón de cerrar. */}
            <span className="pr-6 font-bold">{activa.station_name}</span>
            <span>
              {activa.categoria_nombre ?? "Sin índice en las últimas horas"}
              {activa.valor !== null && ` · ${activa.valor}`}
            </span>
            {franjaHoraria(activa.ts_hour) && (
              <span className="text-xs text-gray-600">
                Hora: {franjaHoraria(activa.ts_hour)}
              </span>
            )}
            {/* La descripción oficial del sitio (planilla de estaciones del
                GCBA), no una clasificación nuestra. */}
            {activa.station_description && (
              <span className="border-t pt-1 text-xs leading-snug text-gray-600">
                {activa.station_description}
              </span>
            )}
          </div>
        </Popup>
      )}
    </Map>
  );
}
