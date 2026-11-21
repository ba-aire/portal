"use client";

import { usePathname } from "next/navigation";
import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { esEstacion, nombreEstacion } from "@/lib/estaciones";
import { cn, splitPathName } from "@/lib/utils";

// Segmentos de la URL que no se muestran con la mayúscula inicial de siempre:
// "ica" es una sigla.
const ETIQUETAS: Record<string, string> = {
  cargas: "Carga de datos",
  ica: "ICA",
  validacion: "Validación",
};

/**
 * Rótulo de un segmento de la URL: el nombre de la estación si es un código
 * ("catalinas" → "La Boca"), una etiqueta fija si la tiene, y si no el
 * segmento con mayúscula inicial ("reporte-mensual" → "Reporte Mensual").
 */
export function etiquetaSegmento(parte: string): string {
  if (esEstacion(parte)) return nombreEstacion(parte);
  if (ETIQUETAS[parte]) return ETIQUETAS[parte];
  return parte
    .split("-")
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(" ");
}

// Las migas son solo texto: varias rutas intermedias ("/datos") no tienen
// página, así que no se muestran como links. La última es la página actual.
export function AppBreadCrumb() {
  const pathName = usePathname();
  const partesRuta = splitPathName(pathName);

  return (
    <Breadcrumb className={cn("flex items-center ml-5")}>
      <BreadcrumbList>
        {partesRuta.map((parte, index) => (
          <React.Fragment key={partesRuta.slice(0, index + 1).join("/")}>
            <BreadcrumbItem>
              {index === partesRuta.length - 1 ? (
                <BreadcrumbPage className="font-medium text-primary">
                  {etiquetaSegmento(parte)}
                </BreadcrumbPage>
              ) : (
                <span className="font-medium text-primary/70">
                  {etiquetaSegmento(parte)}
                </span>
              )}
            </BreadcrumbItem>
            {partesRuta.length > index + 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
