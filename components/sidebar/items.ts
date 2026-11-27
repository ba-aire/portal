import {
  ChartLine,
  Download,
  FileChartLine,
  MapPinned,
  SquareCheck,
  Upload,
  Wind,
} from "lucide-react";
import { CODIGOS_ESTACION, ESTACIONES, urlEstacion } from "@/lib/estaciones";

// ICA = índice de calidad del aire.
export const ica = [
  {
    title: "ICA",
    url: "/ica",
    icon: Wind,
  },
];

export const estaciones = {
  title: "Estaciones",
  icon: MapPinned,
  url: "/estaciones",
  // Una por estación, en el orden de lib/estaciones.ts.
  items: CODIGOS_ESTACION.map((codigo) => ({
    title: ESTACIONES[codigo].nombre,
    url: urlEstacion(codigo),
  })),
};

export const datos = [
  {
    title: "Explorar Datos",
    url: "/datos/contaminante",
    icon: ChartLine,
  },
];

export const reportes = [
  {
    title: "Reportes",
    url: "/reportes",
    icon: FileChartLine,
  },
];

export const descargas = [
  {
    title: "Descargas",
    url: "/descargas",
    icon: Download,
  },
];

// Revisión manual de los datos: invalidar minutos, reincorporar alarmas. La ven
// todos (el listado es parte de leer los datos); registrar y anular, un EDITOR o un ADMIN.
export const validacion = [
  {
    title: "Validación",
    url: "/validacion",
    icon: SquareCheck,
  },
];

// Carga manual de promedios horarios ya validados (cortes de telemetría). La
// ven todos; cargar y anular, un EDITOR o un ADMIN.
export const cargas = [
  {
    title: "Carga de datos",
    url: "/cargas",
    icon: Upload,
  },
];
