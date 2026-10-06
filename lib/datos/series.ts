// Que series y que puntos de /datos se muestran, segun lo que elija el usuario.
// Funcion pura del lado del cliente: prender o apagar un status, o silver/gold,
// no vuelve a consultar la base.
//
// Las columnas que arma lib/datos/repository.ts:
//   "<serie>"           valor de silver (minuto, hora o dia)
//   "<serie>@status"    status del minuto en silver (solo por minuto)
//   "<serie> (gold)"    valor de gold, solo si la ventana es valida (hora y dia)

export const SUFIJO_GOLD = " (gold)";
export const SUFIJO_STATUS = "@status";

/** Status de un minuto en silver (V10), en el orden en que se muestran. */
export const STATUS_MINUTO = [
  { value: "ok", label: "OK" },
  { value: "alarm", label: "Alarma del equipo" },
  { value: "zero", label: "Calibración de cero" },
  { value: "span", label: "Calibración de span" },
  { value: "service", label: "Mantenimiento" },
  { value: "no_link", label: "Sin conexión" },
  { value: "unknown", label: "Desconocido" },
] as const;
export type StatusMinuto = (typeof STATUS_MINUTO)[number]["value"];

export type Fuentes = { silver: boolean; gold: boolean };

type Fila = Record<string, string | number | null>;

export function esGold(serie: string) {
  return serie.endsWith(SUFIJO_GOLD);
}

/** La serie sin el sufijo de gold: para usar el mismo color en las dos. */
export function serieBase(serie: string) {
  return esGold(serie) ? serie.slice(0, -SUFIJO_GOLD.length) : serie;
}

/** Nombres de las series presentes en los datos, sin las columnas de status. */
export function seriesDe(data: Fila[]): string[] {
  const set = new Set<string>();
  for (const fila of data) {
    for (const k of Object.keys(fila)) {
      if (k !== "time" && !k.endsWith(SUFIJO_STATUS)) set.add(k);
    }
  }
  return [...set];
}

/**
 * Devuelve las filas listas para el grafico y la tabla: sin columnas de status,
 * con las series de la fuente apagada removidas, y por minuto con el valor en
 * null donde el status del minuto no esta elegido. Null y no "sacar la fila":
 * el grafico tiene que mostrar el hueco donde hubo, por ejemplo, una calibracion.
 */
export function filtrarSeries(
  data: Fila[],
  interval: string,
  opciones: { statuses: ReadonlySet<string>; fuentes: Fuentes },
): Fila[] {
  const { statuses, fuentes } = opciones;
  return data.map((fila) => {
    const salida: Fila = { time: fila.time };
    for (const [k, v] of Object.entries(fila)) {
      if (k === "time" || k.endsWith(SUFIJO_STATUS)) continue;

      if (interval === "minute") {
        const status = fila[`${k}${SUFIJO_STATUS}`];
        // Un minuto sin status no deberia existir en silver; si aparece, se muestra.
        salida[k] = status == null || statuses.has(String(status)) ? v : null;
        continue;
      }

      if (esGold(k) ? !fuentes.gold : !fuentes.silver) continue;
      salida[k] = v;
    }
    return salida;
  });
}

/**
 * Orden estable para columnas y leyendas: cada serie seguida de su version de
 * gold ("centenario", "centenario (gold)", "cordoba"...). Sin esto el orden sale
 * de como llegaron las filas, que no es el mismo en cada consulta.
 */
export function ordenarSeries(series: string[]): string[] {
  return [...series].sort((a, b) => {
    const base = serieBase(a).localeCompare(serieBase(b));
    if (base !== 0) return base;
    return Number(esGold(a)) - Number(esGold(b));
  });
}
