import type { Metadata } from "next";
import IcaPanel from "./components/ica-panel";

export const metadata: Metadata = {
  title: "BA Aire - ICA",
  description: "Índice de calidad del aire por estación y de la Ciudad",
};

export default function IcaPage() {
  return <IcaPanel />;
}
