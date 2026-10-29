import type { Metadata } from "next";
import Station from "../components/station";

export const metadata: Metadata = {
  title: "SIRCA - Estaciones",
  description: "Estaciones de monitoreo atmosférico",
};

export default async function StationDynamicPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location } = await params;
  return <Station location={location} />;
}
