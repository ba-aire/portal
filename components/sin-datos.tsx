import { SearchX } from "lucide-react";
import { ESCALA_ESTADO } from "@/components/page-header";
import { cn } from "@/lib/utils";

// Lo que se ve cuando la consulta no trajo nada. Texto en azul (no amarillo:
// no llega al contraste mínimo sobre el lienzo claro) y una sugerencia de qué
// cambiar.
export function SinDatos({
  titulo = "No se encontraron datos",
  sugerencia = "Probá con otro rango de fechas, otra estación u otro contaminante.",
}: {
  titulo?: string;
  sugerencia?: string;
}) {
  return (
    <div
      role="status"
      className="w-full h-full flex flex-col items-center justify-center text-center py-10"
    >
      <div className="p-6 bg-secondary/30 rounded-full mb-6">
        <SearchX className="w-14 h-14 text-primary" aria-hidden />
      </div>
      <p className={cn("font-bold text-primary mb-2", ESCALA_ESTADO)}>
        {titulo}
      </p>
      <p className="text-primary/70 max-w-md">{sugerencia}</p>
    </div>
  );
}
