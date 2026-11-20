import type { Metadata } from "next";
import ReportesPanel from "./components/reportes-panel";

export const metadata: Metadata = {
  title: "BA Aire - Reportes",
  description:
    "Reportes mensuales de calidad del aire por estación y contaminante",
};

export default function ReportesPage() {
  return <ReportesPanel />;
}
