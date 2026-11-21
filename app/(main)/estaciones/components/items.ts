import {
  CloudRain,
  Compass,
  Droplets,
  type LucideIcon,
  Sun,
  Thermometer,
  Wind,
  WindArrowDownIcon,
} from "lucide-react";

// Tipos de apoyo para tipar las métricas y evitar indexación por string
export const METRIC_KEYS = {
  CO_MEAN: "co_mean",
  NO_MEAN: "no_mean",
  NO2_MEAN: "no2_mean",
  NOX_MEAN: "nox_mean",
  PM10_MEAN: "pm10_mean",
  PM25_MEAN: "pm25_mean",
  O3_MEAN: "o3_mean",
  SO2_MEAN: "so2_mean",
  TEMP_MEAN: "temp_mean",
  HR_MEAN: "hr_mean",
  DV_MEAN: "dv_mean",
  VV_MEAN: "vv_mean",
  LLUVIA_MEAN: "lluvia_mean",
  PA_MEAN: "pa_mean",
  RS_MEAN: "rs_mean",
  UV_MEAN: "uv_mean",
} as const;

export type MetricKey = (typeof METRIC_KEYS)[keyof typeof METRIC_KEYS];

type Contaminante = {
  key: MetricKey;
  nombre: string;
  nombreCompleto?: string;
  unidad: string;
  /**
   * Decimales con que se muestra el valor (siempre los mismos). PM10 y PM2.5
   * sin decimales, como en el reporte mensual publicado (lib/reportes/config.ts).
   */
  decimales: number;
};

type Meteorologica = {
  key: MetricKey;
  nombre: string;
  nombreCompleto?: string;
  unidad: string;
  /** Decimales con que se muestra el valor (siempre los mismos). */
  decimales: number;
  icon: LucideIcon;
};

export const contaminantes: Contaminante[] = [
  {
    key: METRIC_KEYS.CO_MEAN,
    nombre: "CO",
    nombreCompleto: "Monóxido de Carbono",
    unidad: "ppm",
    decimales: 2,
  },
  {
    key: METRIC_KEYS.NO_MEAN,
    nombre: "NO",
    nombreCompleto: "Monóxido de Nitrógeno",
    unidad: "ppb",
    decimales: 1,
  },
  {
    key: METRIC_KEYS.NO2_MEAN,
    nombre: "NO₂",
    nombreCompleto: "Dióxido de Nitrógeno",
    unidad: "ppb",
    decimales: 1,
  },
  {
    key: METRIC_KEYS.NOX_MEAN,
    nombre: "NOₓ",
    nombreCompleto: "Óxidos Totales",
    unidad: "ppb",
    decimales: 1,
  },
  {
    key: METRIC_KEYS.PM10_MEAN,
    nombre: "PM₁₀",
    nombreCompleto: "Material Particulado",
    unidad: "μg/m³",
    decimales: 0,
  },
  {
    key: METRIC_KEYS.PM25_MEAN,
    nombre: "PM₂.₅",
    nombreCompleto: "Material Particulado 2.5",
    unidad: "μg/m³",
    decimales: 0,
  },
  {
    key: METRIC_KEYS.O3_MEAN,
    nombre: "O₃",
    nombreCompleto: "Ozono",
    unidad: "ppb",
    decimales: 1,
  },
  {
    key: METRIC_KEYS.SO2_MEAN,
    nombre: "SO₂",
    nombreCompleto: "Dióxido de Azufre",
    unidad: "ppb",
    decimales: 1,
  },
];

export const meteorologica: Meteorologica[] = [
  {
    key: METRIC_KEYS.TEMP_MEAN,
    nombre: "Temperatura",
    nombreCompleto: "Temperatura",
    unidad: "°C",
    decimales: 1,
    icon: Thermometer,
  },
  {
    key: METRIC_KEYS.HR_MEAN,
    nombre: "Humedad",
    nombreCompleto: "Humedad Relativa",
    unidad: "%",
    decimales: 0,
    icon: Droplets,
  },
  {
    key: METRIC_KEYS.DV_MEAN,
    nombre: "Dirección Viento",
    nombreCompleto: "Dirección del Viento",
    unidad: "°",
    decimales: 0,
    icon: Compass,
  },
  {
    key: METRIC_KEYS.VV_MEAN,
    nombre: "Velocidad Viento",
    nombreCompleto: "Velocidad del Viento",
    unidad: "m/s",
    decimales: 1,
    icon: Wind,
  },
  {
    key: METRIC_KEYS.LLUVIA_MEAN,
    nombre: "Lluvia",
    nombreCompleto: "Precipitaciones",
    unidad: "mm",
    decimales: 1,
    icon: CloudRain,
  },
  {
    key: METRIC_KEYS.PA_MEAN,
    nombre: "Presión Atm",
    nombreCompleto: "Presión Atmosférica",
    unidad: "hPa",
    decimales: 0,
    icon: WindArrowDownIcon,
  },
  {
    key: METRIC_KEYS.RS_MEAN,
    nombre: "Radiación Solar",
    nombreCompleto: "Radiación Solar",
    unidad: "W/m²",
    decimales: 0,
    icon: Sun,
  },
  {
    key: METRIC_KEYS.UV_MEAN,
    nombre: "UV",
    nombreCompleto: "Ultravioleta",
    unidad: "UV",
    decimales: 0,
    icon: Sun,
  },
];
