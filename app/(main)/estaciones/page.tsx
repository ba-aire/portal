import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CODIGOS_ESTACION, ESTACIONES, urlEstacion } from "@/lib/estaciones";

export const metadata: Metadata = {
  title: "BA Aire - Estaciones",
  description: "Estaciones de monitoreo atmosférico",
};

export default function EstacionesPage() {
  return (
    <div className="w-full h-full p-6 flex flex-col max-w-7xl mx-auto">
      <PageHeader
        title="Estaciones de Monitoreo Atmosférico"
        centrado
        className="mb-6"
      />
      <Card className="flex justify-center items-center max-w-[300px] mx-auto">
        <CardContent className="flex flex-col gap-4">
          {CODIGOS_ESTACION.map((codigo) => (
            <Link key={codigo} href={urlEstacion(codigo)}>
              {ESTACIONES[codigo].nombre}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
