import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Centrado: pantallas de filtros (Explorar Datos, Descargas, Reportes). */
  centrado?: boolean;
  className?: string;
}

// El título de cada pantalla: un solo h1, en mayúsculas, y la bajada como
// párrafo (no como otro título). Ver la skill sirca-design.
export function PageHeader({
  title,
  description = null,
  centrado = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-1",
        centrado && "text-center",
        className,
      )}
    >
      <h1 className="text-2xl font-bold uppercase tracking-wider text-primary">
        {title}
      </h1>
      {description && (
        <p className="font-semibold text-primary/70">{description}</p>
      )}
    </header>
  );
}
