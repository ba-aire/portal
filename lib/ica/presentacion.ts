// Lo que la UI necesita para mostrar un índice y que no depende de React.

// Sin índice o sin color cargado: gris neutro.
export const COLOR_SIN_DATO = "#9CA3AF";

/**
 * Color de texto legible sobre un fondo dado: oscuro sobre los claros (el
 * amarillo de "Moderada", el turquesa de "Buena" europea) y blanco sobre los
 * oscuros (violeta, bordó). Con texto blanco fijo, el AQI más común en Buenos
 * Aires —el amarillo— no se podría leer.
 *
 * Luminancia relativa de WCAG; el corte en 0,3 deja el naranja de la EPA (0,37)
 * con texto oscuro y los rojos (0,21 y 0,28) con texto blanco.
 */
export function colorDeTexto(fondoHex: string | null): string {
  const m = /^#([0-9a-f]{6})$/i.exec(fondoHex ?? "");
  if (!m) return "#111827";
  const n = Number.parseInt(m[1], 16);
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminancia =
    0.2126 * canal((n >> 16) & 255) +
    0.7152 * canal((n >> 8) & 255) +
    0.0722 * canal(n & 255);
  return luminancia > 0.3 ? "#111827" : "#FFFFFF";
}

const HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * "13:00 a 14:00" para la hora que EMPIEZA en ts_hour. gold rotula cada hora
 * por su inicio: el índice de las 13:00 usa lo medido hasta las 14:00, y
 * mostrar solo "13:00" haría parecer el dato una hora más viejo de lo que es.
 */
export function franjaHoraria(tsHour: string | null): string | null {
  if (!tsHour) return null;
  const inicio = new Date(tsHour);
  if (Number.isNaN(inicio.getTime())) return null;
  const fin = new Date(inicio.getTime() + 60 * 60 * 1000);
  return `${HORA.format(inicio)} a ${HORA.format(fin)}`;
}

// --- Selector de hora --------------------------------------------------------

/** Cuántas horas hacia atrás ofrece el selector: dos días, como el visor de la EEA. */
export const HORAS_ATRAS = 48;

const UNA_HORA_MS = 60 * 60 * 1000;

/**
 * El inicio de la hora en curso. Argentina tiene un desfase entero con UTC (y
 * sin horario de verano), así que truncar en UTC es truncar en hora local.
 */
export function horaEnCurso(ahora: Date): Date {
  return new Date(Math.floor(ahora.getTime() / UNA_HORA_MS) * UNA_HORA_MS);
}

/**
 * Las horas que ofrece el selector, de la más vieja a la más nueva, como ISO
 * de su inicio: las HORAS_ATRAS horas completas anteriores a la en curso. La
 * en curso no está porque gold nunca la tiene.
 */
export function horasDelSelector(ahora: Date): string[] {
  const actual = horaEnCurso(ahora).getTime();
  return Array.from({ length: HORAS_ATRAS }, (_, i) =>
    new Date(actual - (HORAS_ATRAS - i) * UNA_HORA_MS).toISOString(),
  );
}

/** "Hace 1 hora", "Hace 33 horas": cuántas horas antes de la en curso empieza. */
export function haceCuanto(tsHour: string, ahora: Date): string {
  const horas = Math.round(
    (horaEnCurso(ahora).getTime() - new Date(tsHour).getTime()) / UNA_HORA_MS,
  );
  return horas === 1 ? "Hace 1 hora" : `Hace ${horas} horas`;
}

const FECHA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Los nombres se escriben acá y no con Intl: según la versión de ICU, el día
// corto en español sale "sáb" o "sáb." y con o sin coma.
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "sáb 21/11, 13:00 a 14:00": el día y la franja de la hora, en hora local. */
export function etiquetaDeHora(tsHour: string | null): string | null {
  const franja = franjaHoraria(tsHour);
  if (!tsHour || !franja) return null;
  // en-CA da "2026-11-21": año, mes y día en hora de Buenos Aires.
  const [anio, mes, dia] = FECHA.format(new Date(tsHour)).split("-");
  const diaSemana = DIAS[new Date(Date.UTC(+anio, +mes - 1, +dia)).getUTCDay()];
  return `${diaSemana} ${dia}/${mes}, ${franja}`;
}

/**
 * Las horas distintas de las estaciones que tienen índice, de la más nueva a la
 * más vieja. En la vista "última hora" cada estación trae la suya: si es una
 * sola se la nombra, si son varias se dice que difieren.
 */
export function horasDistintas(
  estaciones: Array<{ ts_hour: string | null }>,
): string[] {
  const horas = new Set(
    estaciones.flatMap((e) => (e.ts_hour ? [e.ts_hour] : [])),
  );
  return [...horas].sort().reverse();
}

// --- Leyenda -----------------------------------------------------------------

/**
 * El tramo del AQI de cada categoría de la EPA (1 = Buena ... 6 = Peligrosa).
 * Es la escala del número que se ve en los marcadores, fija por definición del
 * AQI; los cortes de concentración de cada contaminante los aplica data, no
 * están acá. El índice europeo no tiene número y no lleva tramos.
 */
export const TRAMOS_AQI: Record<number, string> = {
  1: "0–50",
  2: "51–100",
  3: "101–150",
  4: "151–200",
  5: "201–300",
  6: "301+",
};
