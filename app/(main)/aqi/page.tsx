import type { Metadata } from "next";
import AQIMap from "./components/map";

export const metadata: Metadata = {
  title: "BA Aire - AQI",
  description: "AQI",
};

export default async function AQIPage() {
  return <AQIMap />;
}
