import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "SIRCA - Estaciones",
  description: "Estaciones de monitoreo atmosférico",
};

export default function EstacionesPage() {
  return (
    <div className="w-full h-full p-6 flex flex-col max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-center text-primary mb-6">
        Estaciones de Monitoreo Atmosférico
      </h1>
      <Card className="flex justify-center items-center max-w-[300px] mx-auto">
        <CardContent className="flex flex-col gap-4">
          <Link href="/estaciones/centenario">Centenario</Link>
          <Link href="/estaciones/catalinas">Catalinas</Link>
          <Link href="/estaciones/cordoba">Córdoba</Link>
          <Link href="/estaciones/cifa">CIFA</Link>
        </CardContent>
      </Card>
    </div>
  );
}
