// Que series y que puntos de /datos se muestran, segun lo que elija el usuario.
// Funcion pura del lado del cliente: prender o apagar un status, o una columna
// cruda, no vuelve a consultar la base.
//
// Las columnas que arma lib/datos/repository.ts:
//   por minuto
//     "<serie>"                         valor del minuto en silver
//     "<serie>@status"                  status del minuto
//   por hora
//     "<serie> (validados)"             gold: solo si la hora es valida (>= 75 %)
//     "<serie> (crudo)"                 silver: todos los minutos con valor
//     "<serie> (crudo con alarmas)"     silver: minutos OK + alarma
//     "<serie> (crudo sin alarmas)"     silver: solo minutos OK
//   por media movil de 8 h y de 24 h
//     "<serie> (validados)"             gold: unica fuente, no hay crudo movil

export const SUFIJO_VALIDADOS = " (validados)";
export const SUFIJO_STATUS = "@status";

/**
 * Las tres columnas horarias crudas de silver (V14), en el orden en que se
 * muestran. `detalle` es el texto del tooltip de la UI.
 */
export const FUENTES_CRUDAS = [
  {
    id: "crudo",
    label: "Crudo",
    sufijo: " (crudo)",
    detalle:
      "Promedio horario de todos los minutos con valor, sea cual sea su estado: OK, alarma, calibración y mantenimiento.",
  },
  {
    id: "conAlarmas",
    label: "Crudo con alarmas",
    sufijo: " (crudo con alarmas)",
    detalle:
      "Promedio horario de los minutos OK más los minutos con alarma del equipo. Deja afuera calibraciones y mantenimiento.",
  },
  {
    id: "sinAlarmas",
    label: "Crudo sin alarmas",
    sufijo: " (crudo sin alarmas)",
    detalle:
      "Promedio horario de los minutos OK solamente. Es la base de los validados, antes de pedir el 75 % de datos.",
  },
] as const;
export type FuenteCruda = (typeof FUENTES_CRUDAS)[number]["id"];

/** Que columnas crudas estan prendidas. Los validados se muestran siempre. */
export type Fuentes = Record<FuenteCruda, boolean>;
export const FUENTES_INICIAL: Fuentes = {
  crudo: false,
  conAlarmas: false,
  sinAlarmas: false,
};

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

type Fila = Record<string, string | number | null>;

export function esValidados(serie: string) {
  return serie.endsWith(SUFIJO_VALIDADOS);
}

/** La fuente cruda de una serie horaria, o null si es validados o por minuto. */
export function fuenteCruda(serie: string): FuenteCruda | null {
  return FUENTES_CRUDAS.find((f) => serie.endsWith(f.sufijo))?.id ?? null;
}

/** La serie sin el sufijo de fuente: para usar el mismo color en todas. */
export function serieBase(serie: string) {
  if (esValidados(serie)) return serie.slice(0, -SUFIJO_VALIDADOS.length);
  const cruda = FUENTES_CRUDAS.find((f) => serie.endsWith(f.sufijo));
  return cruda ? serie.slice(0, -cruda.sufijo.length) : serie;
}

// Posicion de la fuente al ordenar: validados primero, despues las crudas.
function ordenFuente(serie: string) {
  if (esValidados(serie)) return 0;
  const i = FUENTES_CRUDAS.findIndex((f) => serie.endsWith(f.sufijo));
  return i === -1 ? 0 : i + 1;
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
 * sin las columnas crudas apagadas, y por minuto con el valor en null donde el
 * status del minuto no esta elegido. Null y no "sacar la fila": el grafico tiene
 * que mostrar el hueco donde hubo, por ejemplo, una calibracion.
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

      const cruda = fuenteCruda(k);
      if (cruda && !fuentes[cruda]) continue;
      salida[k] = v;
    }
    return salida;
  });
}

/**
 * Las series de UNA sola fuente, para apilar: sumar dos fuentes del mismo dato
 * contaria dos veces la misma concentracion. Prefiere validados y, si no hay,
 * la primera cruda presente.
 */
export function seriesDeUnaFuente(series: string[]): string[] {
  const menor = Math.min(...series.map(ordenFuente));
  return series.filter((s) => ordenFuente(s) === menor);
}

/**
 * Orden estable para columnas y leyendas: cada serie seguida de sus otras
 * fuentes ("centenario (validados)", "centenario (crudo)"..., "cordoba..."). Sin
 * esto el orden sale de como llegaron las filas, que no es el mismo en cada
 * consulta.
 */
export function ordenarSeries(series: string[]): string[] {
  return [...series].sort((a, b) => {
    const base = serieBase(a).localeCompare(serieBase(b));
    if (base !== 0) return base;
    return ordenFuente(a) - ordenFuente(b);
  });
}
