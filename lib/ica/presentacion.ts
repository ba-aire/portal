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
