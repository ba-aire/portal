import type { Metadata } from "next";
import { esEstacion, nombreEstacion } from "@/lib/estaciones";
import Station from "../components/station";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ location: string }>;
}): Promise<Metadata> {
  const { location } = await params;
  // Mismo nombre que el menú lateral (p. ej. "catalinas" se muestra como "La Boca").
  return {
    title: esEstacion(location)
      ? `BA Aire - ${nombreEstacion(location)}`
      : "BA Aire - Estaciones",
    description: "Estaciones de monitoreo atmosférico",
  };
}

export default async function StationDynamicPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location } = await params;
  return <Station location={location} />;
}
