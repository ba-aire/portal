import {
  ChartLine,
  Download,
  Map as MapIcon,
  Search,
  Wind,
} from "lucide-react";

// ICA = índice de calidad del aire. La página es, sobre todo, un mapa.
export const ica = [
  {
    title: "ICA",
    url: "/ica",
    icon: MapIcon,
  },
];

export const estaciones = {
  title: "Estaciones",
  icon: Wind,
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
    icon: Search,
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
