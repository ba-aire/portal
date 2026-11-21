/**
 * @file Las tres tablas del reporte (días, estadísticos, perfil horario), como
 * columnas y filas de texto ya formateado.
 * @description Las comparten las dos plantillas: cambia el estilo, no el
 * contenido. La disposición es la de la planilla: con varios parámetros (NOx),
 * cada columna se abre en NO / NO2 / NOx.
 */

import {
  celda,
  celdaHora,
  etiquetaHora,
  GRUPOS_PERFIL,
  numero,
  ORDEN_HORAS_PERFIL,
} from "./formato";
import type { Dia, Estadistico, GrupoPerfil, Serie } from "./models";
import { type Columna, CUBIERTA, type FilaTabla } from "./tabla";
import type { Vista } from "./vista";

export type Encabezados = {
  /** Fondo de la columna de rótulos (días, estadísticos, horas). */
  rotulo: string;
  promedio24: string;
  promedio8: string;
  promedio1: string;
  perfil: string;
  /** Fondo de la celda del mes en el encabezado (gris en la planilla). */
  mes?: string;
  texto?: string;
};

// Por peso y no por familia: así la tabla toma la tipografía de la página
// (Helvetica en la clásica, Source Sans 3 en la nueva).
const negrita = { fontWeight: 700 } as const;

function repartir(anchoTotal: number, primera: number, n: number): Columna[] {
  const resto = (anchoTotal - primera) / n;
  return [
    { ancho: primera, alinear: "center" },
    ...Array.from({ length: n }, () => ({
      ancho: resto,
      alinear: "center" as const,
    })),
  ];
}

/** Una fila de encabezado con los nombres de los parámetros, si hay varios. */
function filaParametros(
  v: Vista,
  grupos: number,
  fondo: string[],
  alto?: number,
  /** Cuántas columnas ocupa la celda tapada de la izquierda. */
  primera = 1,
): FilaTabla[] {
  if (!v.varios) return [];
  const nombres = Array.from({ length: grupos }, () =>
    v.params.map((p) => v.nombre(p)),
  ).flat();
  return [
    {
      // La primera columna la ocupa la celda de arriba (el mes, "HORARIO").
      celdas: [CUBIERTA, ...nombres],
      spans: [primera, ...nombres.map(() => 1)],
      alto,
      estilo: { fontSize: 5.5, ...negrita },
      estilosCelda: [
        { backgroundColor: fondo[0] },
        ...nombres.map((_, i) => ({
          backgroundColor: fondo[1 + Math.floor(i / v.params.length)],
        })),
      ],
    },
  ];
}

// ---- Días -------------------------------------------------------------------------

/**
 * `rotulo` es el ancho de la columna de los días; el resto se reparte en partes
 * iguales entre las columnas de valores.
 */
export function tablaDias(
  v: Vista,
  ancho: number,
  c: Encabezados,
  rotulo = 44,
  /** Alto de cada fila del encabezado, en pt. */
  altoEncabezado = 12,
) {
  const P = v.params.length;
  const columnas = repartir(ancho, rotulo, 6 * P);
  const fondos = [
    c.rotulo,
    c.promedio24,
    c.promedio8,
    c.promedio8,
    c.promedio8,
    c.promedio1,
    c.promedio1,
  ];
  const enc: FilaTabla[] = [
    {
      celdas: [
        v.mesTitulo,
        "Promedio 24 Hs",
        "PROMEDIO 8 HS",
        "Promedio 1 Hora",
      ],
      spans: [1, P, 3 * P, 2 * P],
      // Como la planilla: el mes ocupa todo el alto del encabezado y el
      // promedio de 24 h, las dos primeras filas.
      filasQueOcupa: [v.varios ? 3 : 2, 2, 1, 1],
      alto: altoEncabezado,
      estilo: negrita,
      estilosCelda: [
        // En 6 pt "SEPTIEMBRE 2026" no entra en un renglón y el año baja,
        // como en la planilla.
        { backgroundColor: c.mes ?? c.rotulo, fontSize: 6 },
        { backgroundColor: c.promedio24 },
        { backgroundColor: c.promedio8 },
        { backgroundColor: c.promedio1 },
      ],
    },
    {
      celdas: [CUBIERTA, CUBIERTA, "0 a 8", "8 a 16", "16 a 24", "Max", "Min"],
      spans: [1, P, P, P, P, P, P],
      alto: altoEncabezado,
      estilo: negrita,
      estilosCelda: fondos.map((f) => ({ backgroundColor: f })),
    },
    ...filaParametros(v, 6, fondos, altoEncabezado),
  ];

  const porParametro = v.params.map((p) => v.dias(p));
  const dec = v.cfg.decimales;
  const filas: FilaTabla[] = porParametro[0].map((_, i) => {
    const valores = (f: (d: Dia, p: string) => string) =>
      v.params.map((p, k) => f(porParametro[k][i], p));
    return {
      celdas: [
        String(porParametro[0][i].dia),
        ...valores((d) => celda(d.prom_24h, d.prom_24h_estado, dec)),
        ...valores((d) => celda(d.bloque_0_8, d.bloque_0_8_estado, dec)),
        ...valores((d) => celda(d.bloque_8_16, d.bloque_8_16_estado, dec)),
        ...valores((d) => celda(d.bloque_16_24, d.bloque_16_24_estado, dec)),
        ...valores((d, p) => celdaHora(d.max_1h, d.horas_estado, v.ld(p), dec)),
        ...valores((d, p) => celdaHora(d.min_1h, d.horas_estado, v.ld(p), dec)),
      ],
      estilosCelda: [{ backgroundColor: c.rotulo, ...negrita }],
    };
  });
  return {
    columnas,
    filas: [...enc, ...filas],
    // Las líneas gruesas de la planilla: entre los días, el promedio diario,
    // los bloques de 8 h y las horas; y debajo del encabezado.
    gruesas: [1, 1 + P, 1 + 4 * P],
    filasGruesas: [enc.length - 1],
  };
}

// ---- Estadísticos ----------------------------------------------------------------

const SERIES: Serie[] = ["24h", "8h_0_8", "8h_8_16", "8h_16_24", "1h"];

export function tablaEstadisticos(
  v: Vista,
  ancho: number,
  c: Encabezados,
  rotulo = 92,
  altoEncabezado = 12,
  /**
   * Como la planilla: una celda "Percentiles" que ocupa dos filas, con 95 y 98
   * al lado. Para eso la columna de los rótulos se parte en dos, y los demás
   * rótulos ocupan las dos.
   */
  percentilesAgrupados = false,
) {
  const P = v.params.length;
  const R = percentilesAgrupados ? 2 : 1; // columnas de rótulos
  const columnas = repartir(ancho, rotulo, 5 * P);
  if (percentilesAgrupados) {
    const sub = Math.round(rotulo * 0.24);
    columnas.splice(
      0,
      1,
      {
        ancho: rotulo - sub,
        alinear: "center",
      },
      { ancho: sub, alinear: "center" },
    );
  }
  const fondos = [
    c.rotulo,
    c.promedio24,
    c.promedio8,
    c.promedio8,
    c.promedio8,
    c.promedio1,
  ];
  const enc: FilaTabla[] = [
    {
      celdas: [
        v.mesTitulo,
        "Promedio 24 Hs",
        "PROMEDIO 8 HS",
        "Promedios 1 Hora",
      ],
      spans: [R, P, 3 * P, P],
      // El mes, el promedio de 24 h y las horas ocupan dos filas; solo los
      // bloques de 8 h se abren en 0 a 8, 8 a 16 y 16 a 24.
      filasQueOcupa: [v.varios ? 3 : 2, 2, 1, 2],
      alto: altoEncabezado,
      estilo: negrita,
      estilosCelda: [
        { backgroundColor: c.mes ?? c.rotulo },
        { backgroundColor: c.promedio24 },
        { backgroundColor: c.promedio8 },
        { backgroundColor: c.promedio1 },
      ],
    },
    {
      celdas: [CUBIERTA, CUBIERTA, "0 a 8", "8 a 16", "16 a 24", CUBIERTA],
      spans: [R, P, P, P, P, P],
      alto: altoEncabezado,
      estilo: negrita,
      estilosCelda: fondos.map((f) => ({ backgroundColor: f })),
    },
    ...filaParametros(v, 5, fondos, altoEncabezado, R),
  ];

  const dec = v.cfg.decimales;
  // Los estadísticos que son VALORES de una hora (mínimo, percentiles, máximo,
  // mediana) llevan "<LD" en la columna de las horas; la media y el desvío no
  // son lecturas del equipo y salen como número.
  const fila = (
    rotulo: string | [string, string],
    valor: (e: Estadistico) => number | null,
    esLectura: boolean,
    entero = false,
  ): FilaTabla => ({
    // Un rótulo partido (["Percentiles", "95"]) va en las dos columnas de
    // rótulos; uno solo, en las dos juntas.
    ...(R === 2
      ? Array.isArray(rotulo)
        ? {}
        : { spans: [2, ...Array<number>(5 * P).fill(1)] }
      : {}),
    celdas: [
      ...(Array.isArray(rotulo) ? rotulo : [rotulo]),
      ...SERIES.flatMap((s) =>
        v.params.map((p) => {
          const e = v.estadistico(p, s);
          if (!e || e.n === 0) return entero ? "0" : "SD";
          const x = valor(e);
          if (entero) return String(x ?? 0);
          if (s === "1h" && esLectura) return celdaHora(x, "ok", v.ld(p), dec);
          return numero(x, dec);
        }),
      ),
    ],
    estilosCelda: [
      { backgroundColor: c.rotulo, textAlign: "left" },
      ...(Array.isArray(rotulo) ? [{ backgroundColor: c.rotulo }] : []),
    ],
  });

  const percentiles: FilaTabla[] = percentilesAgrupados
    ? [
        {
          ...fila(["Percentiles", "95"], (e) => e.p95, true),
          filasQueOcupa: [2],
        },
        fila([CUBIERTA, "98"], (e) => e.p98, true),
      ]
    : [
        fila("Percentil 95", (e) => e.p95, true),
        fila("Percentil 98", (e) => e.p98, true),
      ];
  const filas = [
    fila("Cantidad de Datos", (e) => e.n, false, true),
    fila("Mínimo", (e) => e.minimo, true),
    ...percentiles,
    fila("Máximo", (e) => e.maximo, true),
    fila("Media Aritmética", (e) => e.media, false),
    fila("Desvío Estándar", (e) => e.desvio, false),
    fila("Mediana", (e) => e.mediana, true),
  ];
  return {
    columnas,
    filas: [...enc, ...filas],
    // Las líneas gruesas de la planilla: entre los rótulos, el promedio
    // diario, los bloques de 8 h y las horas; y debajo del encabezado.
    gruesas: [R, R + P, R + 4 * P],
    columnasRotulo: R,
    filasGruesas: [enc.length - 1],
  };
}

// ---- Perfil horario ----------------------------------------------------------------

export function gruposDelPerfil(v: Vista): GrupoPerfil[] {
  // Con un parámetro van los nueve grupos; con varios, los cuatro de la planilla
  // de NOx (si no, serían 27 columnas).
  return v.varios
    ? ["mensual", "sabado", "domingo_feriado", "lunes_a_viernes"]
    : [
        "mensual",
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado",
        "domingo_feriado",
        "lunes_a_viernes",
      ];
}

export function tablaPerfil(
  v: Vista,
  ancho: number,
  c: Encabezados,
  altoEncabezado = 12,
) {
  const grupos = gruposDelPerfil(v);
  const P = v.params.length;
  const columnas = repartir(ancho, 58, grupos.length * P);
  const dec = v.cfg.decimales;
  const enc: FilaTabla[] = [
    {
      celdas: ["HORARIO", ...grupos.map((g) => GRUPOS_PERFIL[g])],
      spans: [1, ...grupos.map(() => P)],
      // Con varios parámetros, "HORARIO" ocupa también la fila de NO / NO2 / NOx.
      filasQueOcupa: [v.varios ? 2 : 1],
      alto: altoEncabezado,
      estilo: negrita,
      estilosCelda: [
        { backgroundColor: c.rotulo },
        ...grupos.map(() => ({ backgroundColor: c.perfil })),
      ],
    },
    ...filaParametros(
      v,
      grupos.length,
      [c.rotulo, ...grupos.map(() => c.perfil)],
      altoEncabezado,
    ),
  ];
  const filas: FilaTabla[] = ORDEN_HORAS_PERFIL.map((h) => ({
    celdas: [
      etiquetaHora(h),
      ...grupos.flatMap((g) =>
        v.params.map((p) => numero(v.perfil(p, g, h)?.valor ?? null, dec)),
      ),
    ],
    estilosCelda: [{ backgroundColor: c.rotulo, ...negrita }],
  }));
  return {
    columnas,
    filas: [...enc, ...filas],
    // Con varios parámetros, también entre grupos (Mensual | Sábado | ...).
    gruesas: P > 1 ? grupos.map((_, g) => 1 + g * P) : [1],
    filasGruesas: [enc.length - 1],
  };
}
