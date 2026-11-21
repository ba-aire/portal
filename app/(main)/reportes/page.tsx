import { Loader2 } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import SonnerToaster from "@/components/sonner-toaster";
import { pedidoDe, reporteDe } from "@/lib/reportes/catalogo";
import ReportesPanel from "./components/reportes-panel";
import VistaPrevia from "./components/vista-previa";

export const metadata: Metadata = {
  title: "BA Aire - Reportes",
  description: "Reportes de calidad del aire por estación y contaminante",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Lo que se está mirando vive en la URL (?reporte=mensual-nuevo&estacion=…):
// el selector y "Vista previa" la cambian, y el reporte se arma en el servidor.
// Así también se puede recargar o compartir el link.
export default async function ReportesPage({ searchParams }: Props) {
  const params = await searchParams;
  const reporte = reporteDe(
    Array.isArray(params.reporte) ? params.reporte[0] : params.reporte,
  );
  const pedido = pedidoDe(params);
  return (
    <div className="space-y-8 p-2">
      <SonnerToaster />
      <ReportesPanel reporte={reporte} pedido={pedido} />
      {pedido?.tipo === "mensual" && (
        <Suspense
          key={`${pedido.reporte.id}|${pedido.filtros.estacion}|${pedido.filtros.contaminante}|${pedido.filtros.mes}`}
          fallback={
            <div className="flex justify-center py-16">
              <Loader2 className="size-12 animate-spin text-primary" />
            </div>
          }
        >
          <VistaPrevia
            pedido={{ ...pedido.filtros, plantilla: pedido.reporte.plantilla }}
          />
        </Suspense>
      )}
    </div>
  );
}
