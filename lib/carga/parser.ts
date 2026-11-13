// Lee el archivo de una carga manual: una planilla ANCHA con FECHA, HORA y una
// columna por parámetro, una fila por hora. Es el formato que arma el área
// técnica (ver el ejemplo en tests/lib/carga/parser.test.ts):
//
//   FECHA       HORA   NO     NO2    NOX
//   2026-09-11  05:00  5.26   13.84  19.1
//   2026-09-11  06:00  s/d    20.79  33.72
//
// Sale una lista LARGA de horas {parameter_code, ts_hour, value}, que es lo que
// recibe carga.cargar() (V19 en ba-aire/data). Sin React y sin la librería de
// Excel: trabaja sobre una matriz de celdas, que arma quien abre el archivo.
//
// TODO O NADA. Si algo no se entiende, no sale ninguna hora: una carga a medias
// en el archivo regulatorio es peor que un archivo rechazado con el renglón y
// el motivo.

/** Una celda como la entrega un CSV (texto) o Excel (texto, número o fecha). */
export type Celda = string | number | Date | null | undefined;

export type HoraCargada = {
  parameter_code: string;
  /** Inicio de la hora, ISO en UTC. */
  ts_hour: string;
  value: number;
};

/** Qué marca la columna HORA: el inicio del promedio (como gold) o su final. */
export type MarcaDeHora = "inicio" | "fin";

export type ResultadoParseo =
  | {
      ok: true;
      horas: HoraCargada[];
      /** Los parámetros del archivo, en el orden de sus columnas. */
      parametros: string[];
      filas: number;
      /** Celdas "s/d" o vacías: horas sin dato, que no se cargan. */
      sinDato: number;
    }
  | { ok: false; errores: string[] };

// La red está en Buenos Aires, sin horario de verano desde 2009: la hora local
// del archivo es siempre UTC-3. No se usa el huso del navegador: el archivo
// dice lo mismo lo abra quien lo abra.
const UTC_MENOS_3_H = 3;

// Lo que significa "sin dato" en una celda de valor.
const SIN_DATO = new Set([
  "",
  "s/d",
  "sd",
  "-",
  "--",
  "n/d",
  "nd",
  "na",
  "n/a",
]);

// Cómo se escribe cada parámetro en un encabezado, además de su código.
const ALIAS: Record<string, string> = {
  "pm2.5": "pm25",
  "pm2,5": "pm25",
};

// Más de esto no es una carga eventual: es el histórico, que va por consola.
export const MAX_ERRORES = 20;

function normalizar(s: Celda): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

/** Año, mes (1-12) y día de una celda FECHA, o null. */
function leerFecha(c: Celda): [number, number, number] | null {
  // Excel entrega la fecha como Date a medianoche UTC.
  if (c instanceof Date) {
    return Number.isNaN(c.getTime())
      ? null
      : [c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate()];
  }
  const s = String(c ?? "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return validarFecha(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return validarFecha(+m[3], +m[2], +m[1]);
  return null;
}

function validarFecha(
  a: number,
  m: number,
  d: number,
): [number, number, number] | null {
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a &&
    f.getUTCMonth() === m - 1 &&
    f.getUTCDate() === d
    ? [a, m, d]
    : null;
}

/** La hora (0-24) de una celda HORA, o null. Solo horas en punto. */
function leerHora(c: Celda): number | null {
  // Excel entrega una hora como Date del 30/12/1899, o como fracción del día.
  if (c instanceof Date) {
    if (Number.isNaN(c.getTime())) return null;
    return c.getUTCMinutes() === 0 && c.getUTCSeconds() === 0
      ? c.getUTCHours()
      : null;
  }
  if (typeof c === "number") {
    if (Number.isInteger(c) && c >= 0 && c <= 24) return c;
    const h = c * 24;
    return c > 0 && c < 1 && Math.abs(h - Math.round(h)) < 1e-6
      ? Math.round(h)
      : null;
  }
  const m = /^(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?$/.exec(
    String(c ?? "").trim(),
  );
  if (!m) return null;
  const h = +m[1];
  if (h > 24 || +(m[2] ?? 0) !== 0 || +(m[3] ?? 0) !== 0) return null;
  return h;
}

/** Un valor: número (con punto o coma decimal), "sin dato", o inválido. */
function leerValor(c: Celda): number | "sin_dato" | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  if (c instanceof Date) return null;
  const s = normalizar(c);
  if (SIN_DATO.has(s)) return "sin_dato";
  if (!/^-?\d+([.,]\d+)?$/.test(s)) return null;
  return Number(s.replace(",", "."));
}

/**
 * De la matriz de celdas (la primera fila es el encabezado) a la lista de
 * horas. `codigos` son los parameter_code de dim.parameters: una columna que
 * no es FECHA, HORA ni uno de esos rechaza el archivo.
 */
export function leerPlanilla(
  celdas: Celda[][],
  codigos: readonly string[],
  marca: MarcaDeHora = "inicio",
): ResultadoParseo {
  const errores: string[] = [];
  const error = (m: string) => {
    if (errores.length < MAX_ERRORES) errores.push(m);
  };

  // Las filas enteramente vacías (el final de una hoja de Excel) no cuentan.
  const filas = celdas
    .map((f, i) => ({ f, n: i + 1 }))
    .filter(({ f }) => f.some((c) => normalizar(c) !== ""));
  if (filas.length < 2) {
    return { ok: false, errores: ["El archivo no tiene filas de datos"] };
  }

  // ---- El encabezado ----
  const encabezado = filas[0].f.map(normalizar);
  const iFecha = encabezado.indexOf("fecha");
  const iHora = encabezado.indexOf("hora");
  if (iFecha < 0 || iHora < 0) {
    return {
      ok: false,
      errores: ["Faltan las columnas FECHA y HORA en la primera fila"],
    };
  }
  const conocidos = new Set(codigos);
  const columnas: Array<{ i: number; codigo: string }> = [];
  encabezado.forEach((nombre, i) => {
    if (i === iFecha || i === iHora || nombre === "") return;
    const codigo = ALIAS[nombre] ?? nombre;
    if (!conocidos.has(codigo)) {
      error(`Columna desconocida: «${String(filas[0].f[i]).trim()}»`);
    } else if (columnas.some((c) => c.codigo === codigo)) {
      error(`La columna «${codigo}» está repetida`);
    } else {
      columnas.push({ i, codigo });
    }
  });
  if (columnas.length === 0 && errores.length === 0) {
    error("El archivo no tiene ninguna columna de parámetro");
  }
  if (errores.length > 0) return { ok: false, errores };

  // ---- Las filas ----
  const horas: HoraCargada[] = [];
  const vistas = new Set<number>();
  let sinDato = 0;

  for (const { f, n } of filas.slice(1)) {
    const fecha = leerFecha(f[iFecha]);
    const hora = leerHora(f[iHora]);
    if (!fecha) {
      error(`Fila ${n}: fecha inválida («${String(f[iFecha] ?? "")}»)`);
      continue;
    }
    if (hora === null) {
      error(
        `Fila ${n}: hora inválida («${String(f[iHora] ?? "")}»): tiene que ser una hora en punto`,
      );
      continue;
    }
    // Con la hora al final, el promedio de "05:00" es el de 04:00 a 05:00: su
    // inicio es una hora antes. "24:00" solo tiene sentido así.
    if (hora === 24 && marca === "inicio") {
      error(
        `Fila ${n}: «24:00» solo vale si la hora marca el final del promedio`,
      );
      continue;
    }
    const inicio = Date.UTC(
      fecha[0],
      fecha[1] - 1,
      fecha[2],
      hora + UTC_MENOS_3_H - (marca === "fin" ? 1 : 0),
    );
    if (vistas.has(inicio)) {
      error(`Fila ${n}: la fecha y hora están repetidas`);
      continue;
    }
    vistas.add(inicio);

    for (const { i, codigo } of columnas) {
      const v = leerValor(f[i]);
      if (v === null) {
        error(
          `Fila ${n}, ${codigo}: «${String(f[i])}» no es un número ni «s/d»`,
        );
      } else if (v === "sin_dato") {
        sinDato++;
      } else {
        horas.push({
          parameter_code: codigo,
          ts_hour: new Date(inicio).toISOString(),
          value: v,
        });
      }
    }
  }

  if (errores.length > 0) return { ok: false, errores };
  if (horas.length === 0) {
    return {
      ok: false,
      errores: ["El archivo no trae ningún valor para cargar"],
    };
  }
  return {
    ok: true,
    horas,
    parametros: columnas.map((c) => c.codigo),
    filas: filas.length - 1,
    sinDato,
  };
}

/**
 * Un CSV a matriz de celdas. Separador coma o punto y coma (el que más
 * aparezca en el encabezado: Excel en castellano exporta con punto y coma,
 * y entonces la coma es decimal). Comillas dobles opcionales.
 */
export function csvACeldas(texto: string): string[][] {
  const lineas = texto
    .replace(/^﻿/, "")
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim() !== "");
  if (lineas.length === 0) return [];
  const sep =
    (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  return lineas.map((l) =>
    l.split(sep).map((c) =>
      c
        .trim()
        .replace(/^"(.*)"$/, "$1")
        .trim(),
    ),
  );
}

/**
 * El valor de una celda de ExcelJS a una Celda simple: las fórmulas valen su
 * resultado, el texto con formato su texto, y un error de Excel (#N/A) queda
 * como texto para que el parseo lo rechace con su fila.
 */
export function celdaDeExcel(valor: unknown): Celda {
  if (valor === null || valor === undefined) return null;
  if (
    typeof valor === "string" ||
    typeof valor === "number" ||
    valor instanceof Date
  ) {
    return valor;
  }
  if (typeof valor === "object") {
    const v = valor as {
      result?: unknown;
      richText?: Array<{ text: string }>;
      text?: unknown;
      error?: unknown;
    };
    if ("result" in v) return celdaDeExcel(v.result);
    if (Array.isArray(v.richText))
      return v.richText.map((t) => t.text).join("");
    if (typeof v.text === "string") return v.text;
    if (typeof v.error === "string") return v.error;
  }
  return String(valor);
}

/** Un instante en hora de Buenos Aires, que es la del archivo: "11/09/2026 05:00". */
export function formatearHoraArgentina(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
