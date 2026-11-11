import type { Metadata } from "next";
import IcaPanel from "./components/ica-panel";

export const metadata: Metadata = {
  title: "BA Aire - Índice de calidad del aire",
  description: "Índice de calidad del aire por estación y de la Ciudad",
};

export default function AQIPage() {
  return <IcaPanel />;
}
