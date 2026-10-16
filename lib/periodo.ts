/**
 * @file Rótulos de tiempo de las series.
 * @description airedb rotula cada promedio por el INICIO de su período, con el
 * intervalo semiabierto [inicio, fin): la fila "14:00" de la horaria son los
 * minutos 14:00 a 14:59 (ba-aire/data, silver y gold). Mostrar solo "14:00" se
 * lee como una medición puntual, así que la hora se muestra como el rango que
 * cubre, con el mismo formato que la descarga Excel ("14:00 a 15:00 hs"). El
 * minuto queda con un solo timestamp: el rango sería ruido, pero el encabezado
 * dice que es el inicio.
 *
 * Las medias móviles van al revés: /datos las ubica en el FINAL de su ventana
 * (gold.window_end, ver lib/datos/repository.ts), porque lo que se lee es "el
 * promedio de las últimas 8 h a esta hora". La fila "15/10/2026, 08:00" de la
 * móvil de 24 h promedia de 14/10 08:00 a 15/10 08:00.
 */

export type Periodo = "minute" | "hour" | "mov8h" | "mov24h";

const TZ = "America/Argentina/Buenos_Aires";

const HORA_MS = 60 * 60 * 1000;

const FORMATO_FECHA = new Intl.DateTimeFormat("es-AR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TZ,
});

const FORMATO_HORA = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  // Fijo en 24 hs: sin esto, el formato depende del ICU del navegador
  hourCycle: "h23",
  timeZone: TZ,
});

/** Fecha y hora puntual en hora argentina: "15/01/2026, 11:30". */
export function formatInstante(fecha: Date): string {
  return `${FORMATO_FECHA.format(fecha)}, ${FORMATO_HORA.format(fecha)}`;
}

/**
 * El período que rotula `iso`, en hora argentina:
 * minuto "15/01/2026, 11:30", hora "15/01/2026, 11:00 a 12:00 hs", móvil
 * "15/01/2026, 11:00" (el fin de la ventana).
 * Si `iso` no es una fecha, lo devuelve tal cual.
 */
export function formatPeriodo(iso: string, periodo: Periodo): string {
  const inicio = new Date(iso);
  if (Number.isNaN(inicio.getTime())) return iso;
  if (periodo !== "hour") return formatInstante(inicio);
  const fin = new Date(inicio.getTime() + HORA_MS);
  return `${FORMATO_FECHA.format(inicio)}, ${FORMATO_HORA.format(inicio)} a ${FORMATO_HORA.format(fin)} hs`;
}

/** Encabezado de la columna de tiempo para ese período. */
export function encabezadoPeriodo(periodo: Periodo): string {
  if (periodo === "minute") return "Fecha y hora (inicio del minuto)";
  if (periodo === "mov8h") return "Fecha y hora (fin de las últimas 8 h)";
  if (periodo === "mov24h") return "Fecha y hora (fin de las últimas 24 h)";
  return "Fecha y Hora";
}
