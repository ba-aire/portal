import {
  ChartLine,
  DatabaseCheck,
  DatabaseSearch,
  Download,
  MapPinHouse,
  MapPinned,
  Upload,
} from "lucide-react";
import { CODIGOS_ESTACION, ESTACIONES, urlEstacion } from "@/lib/estaciones";

// ICA = índice de calidad del aire. La página es, sobre todo, un mapa.
export const ica = [
  {
    title: "ICA",
    url: "/ica",
    icon: MapPinned,
  },
];

export const estaciones = {
  title: "Estaciones",
  icon: MapPinHouse,
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
    icon: DatabaseSearch,
  },
];

export const reportes = [
  {
    title: "Reportes",
    url: "/reportes",
    icon: ChartLine,
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
    icon: DatabaseCheck,
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
