import { AlertCircle } from "lucide-react";
import { FONDO_HOJAS } from "@/lib/reportes/html/base";
import { ReporteClasico } from "@/lib/reportes/html/clasico";
import { ReporteNuevo } from "@/lib/reportes/html/nuevo";
import type { ReportePedido } from "@/lib/reportes/impresion";
import { getReporteMensual } from "@/lib/reportes/service";

/**
 * El reporte completo dentro de /reportes, debajo de los filtros: las mismas
 * hojas A4 que abre la página de impresión y que imprime Gotenberg. Se arma en
 * el servidor (las plantillas embeben el logo y las texturas), así que no hay
 * iframe ni otra pestaña.
 */
export default async function VistaPrevia({
  pedido,
}: {
  pedido: ReportePedido;
}) {
  let reporte: Awaited<ReturnType<typeof getReporteMensual>>;
  try {
    reporte = await getReporteMensual(
      pedido.estacion,
      pedido.contaminante,
      pedido.mes,
      pedido.plantilla,
    );
  } catch (error) {
    // Completo en el log; en pantalla, genérico (puede traer SQL).
    console.error("Error armando la vista previa del reporte:", error);
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-red-700">
        <AlertCircle className="size-4" /> No se pudo armar el reporte.
      </p>
    );
  }
  return (
    <section
      aria-label="Vista previa del reporte"
      // Ancho fijo de A4: en pantallas angostas se desplaza de costado.
      className="overflow-x-auto rounded-lg px-2 py-2"
      style={{ backgroundColor: FONDO_HOJAS }}
    >
      {pedido.plantilla === "nuevo" ? (
        <ReporteNuevo reporte={reporte} />
      ) : (
        <ReporteClasico reporte={reporte} />
      )}
    </section>
  );
}
