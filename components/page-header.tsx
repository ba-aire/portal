import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Centrado: pantallas de filtros (Explorar Datos, Descargas, Reportes). */
  centrado?: boolean;
  /**
   * Controles que van en la fila del título, contra el margen derecho (el
   * selector de índice del ICA). La bajada queda debajo de los dos.
   */
  acciones?: ReactNode;
  className?: string;
}

/**
 * La escala del título y de la bajada según el ancho (BAIRE-87). En una
 * notebook la pantalla es baja y el título le comía altura al contenido, así
 * que achica hacia abajo:
 *
 *              título  bajada
 *   celular     20 px   14 px
 *   ≥640 px     22 px   15 px   (tablets y laptops: 1024, 1366, 1440)
 *   ≥1536 px    24 px   16 px   (monitores; el tamaño de antes)
 *
 * Exportadas para los títulos que no pasan por PageHeader (la estación en vivo).
 */
export const ESCALA_TITULO = "text-xl sm:text-[1.375rem]/7 2xl:text-2xl";
export const ESCALA_BAJADA = "text-sm sm:text-[0.9375rem]/6 2xl:text-base";

// El título de cada pantalla: un solo h1, en mayúsculas, y la bajada como
// párrafo (no como otro título). Ver la skill sirca-design.
export function PageHeader({
  title,
  description = null,
  centrado = false,
  acciones = null,
  className,
}: PageHeaderProps) {
  const titulo = (
    <h1
      className={cn(
        "font-bold uppercase tracking-wider text-primary",
        ESCALA_TITULO,
      )}
    >
      {title}
    </h1>
  );
  return (
    <header
      className={cn(
        "flex flex-col gap-1",
        centrado && "text-center",
        className,
      )}
    >
      {acciones ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {titulo}
          {acciones}
        </div>
      ) : (
        titulo
      )}
      {description && (
        <p className={cn("font-semibold text-primary/70", ESCALA_BAJADA)}>
          {description}
        </p>
      )}
    </header>
  );
}
