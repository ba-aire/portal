/**
 * @file Utilidades para la generación y descarga de archivos CSV y Excel.
 * @description Proporciona funciones para formatear datos crudos de la base de datos
 * en archivos descargables, aplicando reglas de negocio sobre columnas y decimales.
 * @author Ezequiel Maranda
 * @version 1.4.0
 * @since 2026-03-11
 */

import ExcelJS from "exceljs";
import type { FiltrosType } from "@/app/(main)/descargas/components/filters";
import {
  locationOptions,
  promedioOptions,
} from "@/app/(main)/descargas/components/filters";
import type { DataRow } from "@/hooks/useFetchDescargas";
import { TABLE_CONFIG } from "./config";

// Listas de columnas numéricas agrupadas por cantidad de decimales
const ONE_DECIMAL_COLUMNS = new Set<string>([
  // Ejemplo: variables meteorológicas, se pueden ajustar si es necesario
  "dv",
  "vv",
  "temp",
  "hr",
  "pa",
  "uv",
  "lluvia",
  "rs",
]);

// Resto de contaminantes con 2 decimales
const TWO_DECIMAL_COLUMNS = new Set<string>([
  "no",
  "no2",
  "nox",
  "so2",
  "o3",
  "pm10",
  "pm25",
]);

// CO con 3 decimales
const THREE_DECIMAL_COLUMNS = new Set<string>(["co"]);

// Umbral de respaldo horario: 45 minutos válidos = 75% de la hora.
const MIN_K_MINUTES_PER_HOUR = 45;

// Relleno para resaltar promedios validados con respaldo insuficiente.
const LOW_COVERAGE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFEB9C" },
};

// Bordes de la grilla: finos para las celdas, medios para separar grupos de
// columnas (una tabla de InfluxDB por grupo) y el cambio de día.
const THIN_BORDER: ExcelJS.Border = {
  style: "thin",
  color: { argb: "FFD0D0D0" },
};
const GROUP_BORDER: ExcelJS.Border = {
  style: "medium",
  color: { argb: "FFA0A0A0" },
};
const DAY_BORDER: ExcelJS.Border = {
  style: "medium",
  color: { argb: "FF808080" },
};

// Banda de fondo que alterna día por medio para distinguirlos de un vistazo.
const DAY_BAND_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE0E0E0" },
};

// Alineación de la grilla: encabezados y datos centrados en ambos ejes. Las
// notas de arriba quedan afuera: son texto corrido y se leen desde la izquierda.
const GRID_ALIGNMENT: Partial<ExcelJS.Alignment> = {
  horizontal: "center",
  vertical: "middle",
};

const LEGEND_FONT: Partial<ExcelJS.Font> = {
  italic: true,
  size: 10,
  color: { argb: "FF595959" },
};

// Tipografía de la nota con fondo amarillo (mismo criterio que el estilo
// "neutral" de Excel: texto ocre sobre FFEB9C).
const LOW_COVERAGE_LEGEND_FONT: Partial<ExcelJS.Font> = {
  italic: true,
  size: 10,
  color: { argb: "FF9C6500" },
};

// Significado de cada status según la convención de la red.
const STATUS_LEGEND =
  "Status: K = OK (dato válido) · A = Alarma equipo · V = Valor negativo/fuera de rango · " +
  "M = Mantenimiento · Z = Zero cal · S = Span cal · s/d = sin dato";

// Mapa métrica -> tabla de origen, para ubicar el conteo de minutos válidos.
const METRIC_TO_TABLE = new Map<string, string>();
Object.entries(TABLE_CONFIG).forEach(([tableKey, config]) => {
  config.metrics.forEach((metric) => {
    METRIC_TO_TABLE.set(metric.replace("_mean", ""), tableKey);
  });
});

/**
 * Determina la integración: usa la recibida o la infiere de los campos presentes.
 * La consulta horaria trae series `_raw` y conteos `_k_status`; la minutal sólo `_status`.
 */
function resolveIntegration(data: DataRow[], integration?: string): string {
  if (integration) return integration;

  const fields = new Set<string>();
  data?.forEach((row) => {
    Object.keys(row).forEach((key) => {
      fields.add(key);
    });
  });

  const fieldList = Array.from(fields);
  if (fieldList.some((f) => f.endsWith("_k_status") || f.endsWith("_raw"))) {
    return "hour";
  }
  return fieldList.some((f) => f.endsWith("_status")) ? "minute" : "hour";
}

// Hoja de destino de las columnas: "crudos" lleva las series _raw, "validados"
// las series validadas (sólo minutos k) y "all" ambas (CSV).
type SheetVariant = "all" | "crudos" | "validados";

/**
 * Genera el listado de columnas ordenadas basándose en la configuración global (TABLE_CONFIG).
 *
 * @param data Los datos crudos obtenidos de la consulta.
 * @param integration Opcional. Tipo de promedio para determinar los sufijos de las columnas de estado.
 * @param variant Hoja de destino de las columnas.
 * @returns Array de strings con los nombres de las columnas en el orden correcto.
 */
function getOrderedColumns(
  data: DataRow[],
  integration?: string,
  variant: SheetVariant = "all",
): string[] {
  const allFields = new Set<string>();

  // Collect all fields from data first
  if (data && data.length > 0) {
    data.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key !== "time" && key !== "location") {
          allFields.add(key);
        }
      });
    });
  }

  const inferIntegration = resolveIntegration(data, integration);

  // Generar orden de columnas basado en TABLE_CONFIG
  const orderedFields: string[] = [];
  const seen = new Set<string>();
  // Campos que pertenecen a TABLE_CONFIG aunque no vayan en esta hoja: evita
  // que el arrastre final los agregue como "extras" en la hoja equivocada.
  const known = new Set<string>();

  const push = (field: string) => {
    if (!seen.has(field)) {
      orderedFields.push(field);
      seen.add(field);
    }
  };

  Object.entries(TABLE_CONFIG).forEach(([tableKey, config]) => {
    // Agregar métricas de cada tabla
    config.metrics.forEach((metric) => {
      const fieldName = metric.replace("_mean", "");
      const rawField = `${fieldName}_raw`;
      known.add(fieldName);
      known.add(rawField);

      if (inferIntegration === "hour") {
        if (variant !== "crudos") push(fieldName);
        if (variant !== "validados") push(rawField);
      } else {
        push(fieldName);
      }
    });

    // Agregar campos de estado de cada tabla según el tipo de integración:
    // la horaria trae los status observados y el conteo de minutos k; la
    // minutal sólo el status del minuto.
    const statusField = `${tableKey}_status`;
    const kCountField = `${tableKey}_k_status`;
    known.add(statusField);
    known.add(kCountField);

    if (variant !== "validados") {
      push(statusField);
      if (inferIntegration === "hour") {
        push(kCountField);
      }
    }
  });

  // Agregar cualquier campo adicional que no esté en TABLE_CONFIG
  allFields.forEach((field) => {
    if (seen.has(field) || known.has(field)) return;
    if (
      variant === "validados" &&
      (field.endsWith("_status") || field.endsWith("_raw"))
    ) {
      return;
    }
    push(field);
  });

  return orderedFields;
}

/**
 * Genera un nombre de archivo descriptivo basado en los filtros aplicados.
 *
 * @param filters Filtros de búsqueda (estación, fecha, integración).
 * @param extension Extensión del archivo deseada ("csv" o "xlsx").
 * @returns Nombre del archivo formateado.
 */
export function generateFilename(
  filters: FiltrosType,
  extension: "csv" | "xlsx",
): string {
  const locationLabel =
    locationOptions.find((opt) => opt.value === filters.location)?.label ||
    filters.location;
  const integrationLabel =
    promedioOptions.find((opt) => opt.value === filters.integration)?.label ||
    filters.integration;

  const locationSlug = locationLabel.toLowerCase().replace(/\s+/g, "_");
  const integrationSlug = integrationLabel.toLowerCase().replace(/\s+/g, "_");

  let dateRange = "";
  if (filters.startDate && filters.endDate) {
    const start = filters.startDate.toISOString().split("T")[0];
    const end = filters.endDate.toISOString().split("T")[0];
    dateRange = `${start}_${end}`;
  } else if (filters.startDate) {
    dateRange = filters.startDate.toISOString().split("T")[0];
  }

  const parts = ["descargas", locationSlug, integrationSlug, dateRange].filter(
    Boolean,
  );

  return `${parts.join("_")}.${extension}`;
}

/**
 * Formatea un valor individual para su correcta inclusión en una fila de CSV.
 * Maneja el escape de comillas, comas y saltos de línea según el estándar RFC 4180.
 *
 * @param value Valor crudo (número, string o nulo).
 * @returns Valor formateado como string seguro para CSV.
 */
function formatCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // Si contiene comas, comillas o saltos de línea, envolver en comillas
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    // Escapar comillas dobles duplicándolas
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Formatea la fecha de un bin horario con el rango que cubre: la fila "14:00"
 * contiene los minutos de 14:01 a 15:00, así que mostrar el rango completo
 * evita leerla como una medición puntual de las 14:00.
 *
 * @param dateString Fecha del bin en formato string ISO.
 * @returns Fecha y rango horario formateados (DD/MM/AAAA, HH:mm a HH:mm hs).
 */
function formatHourRangeDate(dateString: string): string {
  try {
    const start = new Date(dateString);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const timeZone = "America/Argentina/Buenos_Aires";
    const fecha = new Intl.DateTimeFormat("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    }).format(start);
    const hora = new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      // Fijo en 24 hs: sin esto, el formato depende del ICU del navegador
      hourCycle: "h23",
      timeZone,
    });
    return `${fecha}, ${hora.format(start)} a ${hora.format(end)} hs`;
  } catch {
    return dateString;
  }
}

/**
 * Formatea una fecha ISO a un formato local legible (es-AR).
 *
 * @param dateString Fecha en formato string ISO.
 * @returns Fecha y hora formateada (DD/MM/AAAA, HH:mm).
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      // Fijo en 24 hs: sin esto, el formato depende del ICU del navegador
      hourCycle: "h23",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Orquestador para descargar los datos en formato CSV.
 *
 * @param data Array de objetos con las filas de datos.
 * @param filename Nombre que tendrá el archivo descargado.
 * @param integration Opcional. Ayuda a normalizar las columnas de estado.
 */
export function downloadAsCSV(
  data: DataRow[],
  filename: string,
  integration?: string,
): void {
  if (!data || data.length === 0) {
    throw new Error("No hay datos para descargar");
  }

  // Obtener todas las columnas ordenadas según TABLE_CONFIG
  const columns = getOrderedColumns(data, integration);
  const headers = [
    "Fecha y Hora",
    ...columns.map((col) => {
      if (col === "catalinas") return "La Boca";
      return col.charAt(0).toUpperCase() + col.slice(1);
    }),
  ];

  // Crear líneas CSV
  const csvLines: string[] = [headers.map(formatCSVValue).join(",")];

  // Agregar filas de datos
  data.forEach((row) => {
    const values = [
      formatDate(row.time),
      ...columns.map((col) => {
        const value = row[col];
        if (value === null || value === undefined) {
          return "s/d";
        }
        if (value === "k" || value === "i") {
          return String(value).toUpperCase();
        }
        if (typeof value === "number") {
          return Number(value).toFixed(3);
        }
        return String(value);
      }),
    ];
    csvLines.push(values.map(formatCSVValue).join(","));
  });

  const csvContent = csvLines.join("\n");

  // Crear blob y descargar
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Nombre base de una columna: las series _raw heredan el de su métrica. */
function baseColumnName(col: string): string {
  return col.endsWith("_raw") ? col.slice(0, -"_raw".length) : col;
}

/**
 * Indica si el promedio validado de esa celda se construyó con menos de
 * 45 minutos con status k (75% de la hora).
 */
function hasLowKCoverage(row: DataRow, column: string): boolean {
  const tableKey = METRIC_TO_TABLE.get(column);
  if (!tableKey) return false;
  const kCount = row[`${tableKey}_k_status`];
  return (
    typeof kCount === "number" &&
    kCount < MIN_K_MINUTES_PER_HOUR &&
    typeof row[column] === "number"
  );
}

/**
 * Indica si esa celda es un conteo de minutos k por debajo de 45 (75% de la
 * hora). Se evalúa sobre la propia columna *_k_status de la hoja crudos, que es
 * donde se lee el respaldo de la hora antes de mirar el promedio validado.
 */
function hasLowKCount(row: DataRow, column: string): boolean {
  if (!column.endsWith("_k_status")) return false;
  const kCount = row[column];
  return typeof kCount === "number" && kCount < MIN_K_MINUTES_PER_HOUR;
}

/** Grupo visual al que pertenece una columna: su tabla de origen en InfluxDB. */
function groupKeyOf(col: string): string {
  const base = baseColumnName(col);
  const fromMetric = METRIC_TO_TABLE.get(base);
  if (fromMetric) return fromMetric;
  if (col.endsWith("_k_status")) return col.slice(0, -"_k_status".length);
  if (col.endsWith("_status")) return col.slice(0, -"_status".length);
  return "extra";
}

/** Formato numérico según la precisión del instrumento de la métrica. */
function numFmtFor(baseCol: string): string | undefined {
  if (THREE_DECIMAL_COLUMNS.has(baseCol)) return "0.000";
  if (TWO_DECIMAL_COLUMNS.has(baseCol)) return "0.00";
  if (ONE_DECIMAL_COLUMNS.has(baseCol)) return "0.0";
  return undefined;
}

interface LegendLine {
  text: string;
  /** Fondo de la línea completa (sirve de muestra del color que explica). */
  fill?: ExcelJS.Fill;
  /** Tipografía de la línea; por defecto usa LEGEND_FONT. */
  font?: Partial<ExcelJS.Font>;
}

interface WorksheetOptions {
  /** Notas aclaratorias que van arriba de la grilla. */
  legend?: LegendLine[];
  /** Muestra la fecha como rango horario ("14:00 a 15:00 hs"). */
  hourRangeLabels?: boolean;
  /** Muestra las columnas _raw con el nombre base de su métrica (hoja crudos). */
  stripRawSuffix?: boolean;
  /** Resalta la celda cuando el predicado da true (respaldo insuficiente). */
  highlightCell?: (row: DataRow, column: string) => boolean;
}

/**
 * Helper interno para volcar datos y aplicar estilos a una hoja de ExcelJS:
 * notas aclaratorias arriba, encabezados congelados, bordes que separan los
 * grupos de columnas y el cambio de día (banda alternada día por medio), y
 * formato numérico según la precisión de cada instrumento.
 *
 * @param worksheet Instancia de la hoja de Excel.
 * @param data Datos a insertar.
 * @param columns Lista de columnas a incluir en esta hoja.
 * @param options Ajustes de leyenda, encabezados y resaltado propios de cada hoja.
 */
function addDataToWorksheet(
  worksheet: ExcelJS.Worksheet,
  data: DataRow[],
  columns: string[],
  options: WorksheetOptions = {},
) {
  const totalColumns = columns.length + 1; // +1 por "Fecha y Hora"

  // Notas aclaratorias arriba de la grilla, cada una fusionada a lo ancho y
  // arrancando en la primera columna, sin bordes que corten el texto
  const legend = options.legend ?? [];
  legend.forEach((line) => {
    const legendRow = worksheet.addRow([]);
    worksheet.mergeCells(legendRow.number, 1, legendRow.number, totalColumns);
    const cell = legendRow.getCell(1);
    cell.value = line.text;
    cell.font = line.font ?? LEGEND_FONT;
    if (line.fill) {
      cell.fill = line.fill;
    }
  });
  if (legend.length > 0) {
    worksheet.addRow([]); // fila en blanco entre las notas y el encabezado
  }

  // Columnas donde empieza un grupo nuevo (índice dentro de `columns`)
  const startsGroup = columns.map(
    (col, index) =>
      index === 0 || groupKeyOf(col) !== groupKeyOf(columns[index - 1]),
  );

  const borderFor = (cellIndex: number, top: ExcelJS.Border) => ({
    top,
    bottom: THIN_BORDER,
    left:
      cellIndex >= 2 && startsGroup[cellIndex - 2] ? GROUP_BORDER : THIN_BORDER,
    right: THIN_BORDER,
  });

  // Agregar encabezados
  const headers = [
    "Fecha y Hora",
    ...columns.map((col) => {
      const name = options.stripRawSuffix ? baseColumnName(col) : col;
      if (name === "catalinas") return "La Boca";
      return name.charAt(0).toUpperCase() + name.slice(1);
    }),
  ];
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  for (let cellIndex = 1; cellIndex <= totalColumns; cellIndex++) {
    const cell = headerRow.getCell(cellIndex);
    cell.fill = HEADER_FILL;
    cell.alignment = GRID_ALIGNMENT;
    // Borde inferior medio: separa el encabezado del primer día de datos
    cell.border = { ...borderFor(cellIndex, THIN_BORDER), bottom: DAY_BORDER };
  }

  // Agregar filas de datos
  let previousDay: string | null = null;
  let dayParity = 0;
  data.forEach((row) => {
    const values: (string | number)[] = [
      options.hourRangeLabels
        ? formatHourRangeDate(row.time)
        : formatDate(row.time),
      ...columns.map((col) => {
        const value = row[col];
        if (value === null || value === undefined) {
          return "s/d";
        }
        if (value === "k" || value === "i") {
          return String(value).toUpperCase();
        }
        if (typeof value === "number") {
          // Determinar decimales según la columna
          const baseCol = baseColumnName(col);
          let decimals = 1;
          if (THREE_DECIMAL_COLUMNS.has(baseCol)) {
            decimals = 3;
          } else if (TWO_DECIMAL_COLUMNS.has(baseCol)) {
            decimals = 2;
          } else if (ONE_DECIMAL_COLUMNS.has(baseCol)) {
            decimals = 1;
          }
          return Number(value.toFixed(decimals));
        }
        return String(value);
      }),
    ];
    const excelRow = worksheet.addRow(values);

    // El día se compara en hora argentina, igual que la fecha mostrada
    const day = formatDate(row.time).split(",")[0];
    const isNewDay = previousDay !== null && day !== previousDay;
    if (isNewDay) {
      dayParity = 1 - dayParity;
    }
    previousDay = day;

    for (let cellIndex = 1; cellIndex <= totalColumns; cellIndex++) {
      const cell = excelRow.getCell(cellIndex);
      cell.border = borderFor(cellIndex, isNewDay ? DAY_BORDER : THIN_BORDER);
      cell.alignment = GRID_ALIGNMENT;
      if (dayParity === 1) {
        cell.fill = DAY_BAND_FILL;
      }

      const col = cellIndex >= 2 ? columns[cellIndex - 2] : null;
      if (col) {
        if (typeof row[col] === "number") {
          const fmt = numFmtFor(baseColumnName(col));
          if (fmt) {
            cell.numFmt = fmt;
          }
        }
        if (options.highlightCell?.(row, col)) {
          cell.fill = LOW_COVERAGE_FILL;
        }
      }
    }
  });

  // Congelar las notas y los encabezados. Sin xSplit a propósito: la línea
  // divisoria del panel vertical se dibuja a lo alto de toda la hoja y
  // atraviesa las notas fusionadas de arriba.
  worksheet.views = [{ state: "frozen", ySplit: headerRow.number }];

  // Ajustar ancho de columnas (el rango horario es más largo que la hora puntual)
  worksheet.getColumn(1).width = options.hourRangeLabels ? 28 : 20;
  columns.forEach((_, index) => {
    worksheet.getColumn(index + 2).width = 15;
  });
}

/**
 * Orquestador para descargar los datos en formato Excel (.xlsx).
 * Crea dos hojas: "crudos" (promedio de todos los minutos más los status
 * observados) y "validados" (promedio sólo de minutos con status k). En la
 * integración horaria se resaltan las horas con menos de 45 minutos válidos:
 * en crudos sobre el conteo *_k_status y en validados sobre el promedio.
 * Cada hoja abre con notas: crudos explica qué contiene y el significado de
 * cada status; validados, qué contiene y qué indica el resaltado amarillo.
 *
 * @param data Array de objetos con las filas de datos.
 * @param filename Nombre que tendrá el archivo descargado.
 * @param integration Opcional. Ayuda a normalizar las columnas de estado.
 */
export async function downloadAsExcel(
  data: DataRow[],
  filename: string,
  integration?: string,
): Promise<void> {
  if (!data || data.length === 0) {
    throw new Error("No hay datos para descargar");
  }

  const resolvedIntegration = resolveIntegration(data, integration);
  const isHour = resolvedIntegration === "hour";

  const crudosLegend: LegendLine[] = [
    {
      text: isHour
        ? "Hoja CRUDOS: promedio horario de todos los minutos registrados, sin importar su status."
        : "Hoja CRUDOS: valores minutales con el status reportado por cada equipo.",
    },
    { text: STATUS_LEGEND },
    ...(isHour
      ? [
          {
            text: "Las columnas *_status listan los status observados en cada hora; las *_k_status cuentan los minutos en status K (sobre 60).",
          },
          {
            text: `Conteo resaltado en amarillo: la hora tuvo menos de ${MIN_K_MINUTES_PER_HOUR} minutos en status K (75% de la hora), por lo que su promedio validado es menos representativo.`,
            fill: LOW_COVERAGE_FILL,
            font: LOW_COVERAGE_LEGEND_FONT,
          },
        ]
      : []),
  ];

  // Sin la leyenda de status: vive en crudos, que es donde aparecen los códigos.
  const validadosLegend: LegendLine[] = isHour
    ? [
        {
          text: "Hoja VALIDADOS: promedio horario construido únicamente con los minutos en status K (OK).",
        },
        {
          text: `Valor resaltado en amarillo: la hora se promedió con menos de ${MIN_K_MINUTES_PER_HOUR} minutos válidos (75% de la hora), por lo que es menos representativa.`,
          fill: LOW_COVERAGE_FILL,
          font: LOW_COVERAGE_LEGEND_FONT,
        },
      ]
    : [
        {
          text: "Hoja VALIDADOS: valores minutales sin las columnas de status.",
        },
      ];

  // Crear workbook
  const workbook = new ExcelJS.Workbook();

  // Primera worksheet: "crudos". En la integración horaria lleva las series
  // _raw (mostradas con su nombre base) junto a los status observados y el
  // conteo de minutos válidos de cada hora.
  const crudosColumns = getOrderedColumns(data, resolvedIntegration, "crudos");
  const crudosWorksheet = workbook.addWorksheet("crudos");
  addDataToWorksheet(crudosWorksheet, data, crudosColumns, {
    legend: crudosLegend,
    hourRangeLabels: isHour,
    stripRawSuffix: true,
    highlightCell: isHour ? hasLowKCount : undefined,
  });

  // Segunda worksheet: "validados", sin columnas de estado ni series _raw.
  const validadosColumns = getOrderedColumns(
    data,
    resolvedIntegration,
    "validados",
  );
  const validadosWorksheet = workbook.addWorksheet("validados");
  addDataToWorksheet(validadosWorksheet, data, validadosColumns, {
    legend: validadosLegend,
    hourRangeLabels: isHour,
    highlightCell: isHour ? hasLowKCoverage : undefined,
  });

  // Generar buffer y descargar
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
