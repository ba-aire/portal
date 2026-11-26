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
    <h1 className="text-2xl font-bold uppercase tracking-wider text-primary">
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
        <p className="font-semibold text-primary/70">{description}</p>
      )}
    </header>
  );
}
