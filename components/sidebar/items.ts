import {
  BadgeCheck,
  ChartLine,
  Download,
  FileChartColumn,
  MapPinned,
  Upload,
  Wind,
} from "lucide-react";

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
  items: [
    {
      title: "Centenario",
      url: "/estaciones/centenario",
    },
    {
      title: "La Boca",
      url: "/estaciones/catalinas",
    },
    {
      title: "Córdoba",
      url: "/estaciones/cordoba",
    },
    {
      title: "CIFA",
      url: "/estaciones/cifa",
    },
  ],
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
    icon: FileChartColumn,
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
    icon: BadgeCheck,
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
