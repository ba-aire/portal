// Reportes de prueba. El de CO copia la hoja 1 del PDF publicado de
// septiembre de 2026 en Parque Centenario (planilla Excel): si las tablas que
// arma el portal escriben esos mismos textos, la plantilla clásica reproduce la
// planilla. El de NOx es sintético y cubre lo que el de CO no tiene: varios
// parámetros, SD/DND, "<LD" y excedencias.
import type {
  CeldaPerfil,
  Dia,
  Estadistico,
  GrupoPerfil,
  ReporteMensual,
  Serie,
} from "@/lib/reportes/models";

// día: prom24 | 0-8 | 8-16 | 16-24 | máx 1 h | mín 1 h
const CO_SEPTIEMBRE = `
1 0,5 0,4 0,6 0,6 0,8 0,3
2 0,6 0,4 0,5 0,8 1,0 0,3
3 0,4 0,4 0,4 0,3 0,8 0,2
4 0,3 0,2 0,3 0,5 0,8 0,1
5 0,2 0,1 0,2 0,2 0,4 0,1
6 0,2 0,2 0,2 0,2 0,3 0,1
7 0,2 0,2 0,2 0,3 0,4 0,1
8 0,3 0,2 0,3 0,4 0,5 0,1
9 0,4 0,3 0,3 0,5 0,6 0,2
10 0,3 0,3 0,3 0,4 0,9 0,1
11 0,4 0,3 0,5 0,4 0,9 0,2
12 0,2 0,2 0,2 0,2 0,3 0,1
13 0,2 0,2 0,2 0,3 0,3 0,2
14 0,3 0,2 0,3 0,4 0,6 0,1
15 0,3 0,3 0,3 0,2 0,5 0,1
16 0,3 0,2 0,3 0,4 0,5 0,1
17 0,5 0,3 0,3 0,8 1,7 0,2
18 0,4 0,3 0,4 0,7 1,0 0,2
19 0,4 0,3 0,3 0,5 0,6 0,2
20 0,4 0,4 0,3 0,4 0,6 0,3
21 0,2 0,2 0,2 0,2 0,3 0,2
22 0,3 0,2 0,3 0,5 0,7 0,2
23 0,3 0,3 0,3 0,4 0,5 0,2
24 0,4 0,3 0,4 0,5 0,6 0,2
25 0,5 0,3 0,4 0,6 0,9 0,2
26 0,3 0,2 0,3 0,3 0,5 0,2
27 0,3 0,2 0,3 0,3 0,4 0,2
28 0,3 0,2 0,4 0,4 0,6 0,2
29 0,4 0,3 0,4 0,4 0,5 0,2
30 0,3 0,3 0,4 0,4 0,5 0,2`;

// serie: n | mín | P95 | P98 | máx | media | desvío | mediana
const CO_ESTADISTICOS: Record<Serie, number[]> = {
  "24h": [30, 0.2, 0.5, 0.5, 0.6, 0.3, 0.1, 0.3],
  "8h_0_8": [30, 0.1, 0.4, 0.4, 0.4, 0.3, 0.1, 0.3],
  "8h_8_16": [30, 0.2, 0.5, 0.5, 0.6, 0.3, 0.1, 0.3],
  "8h_16_24": [30, 0.2, 0.7, 0.8, 0.8, 0.4, 0.2, 0.4],
  "1h": [716, 0.1, 0.6, 0.8, 1.7, 0.3, 0.2, 0.3],
};

const GRUPOS: GrupoPerfil[] = [
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

const num = (s: string) => Number(s.replace(",", "."));

function dia(
  parameter_code: string,
  d: number,
  v: (number | null)[],
  estados?: Partial<Dia>,
): Dia {
  const est = (x: number | null) =>
    (x === null ? "SD" : "ok") as Dia["prom_24h_estado"];
  return {
    parameter_code,
    fecha: `2026-09-${String(d).padStart(2, "0")}`,
    dia: d,
    prom_24h: v[0],
    prom_24h_estado: est(v[0]),
    bloque_0_8: v[1],
    bloque_0_8_estado: est(v[1]),
    bloque_8_16: v[2],
    bloque_8_16_estado: est(v[2]),
    bloque_16_24: v[3],
    bloque_16_24_estado: est(v[3]),
    max_1h: v[4],
    min_1h: v[5],
    horas_estado: est(v[4]),
    n_horas_validas: v[4] === null ? 0 : 24,
    ...estados,
  };
}

function estadistico(
  parameter_code: string,
  serie: Serie,
  x: number[],
): Estadistico {
  const [n, minimo, p95, p98, maximo, media, desvio, mediana] = x;
  return {
    parameter_code,
    serie,
    n,
    minimo,
    p95,
    p98,
    maximo,
    media,
    desvio,
    mediana,
  };
}

function perfil(parameter_code: string, base: number): CeldaPerfil[] {
  return GRUPOS.flatMap((grupo, g) =>
    Array.from({ length: 24 }, (_, h) => ({
      parameter_code,
      hora_inicio: h,
      grupo,
      valor: base + h / 100 + g / 1000,
      n: 4,
    })),
  );
}

export function reporteCO(): ReporteMensual {
  const filas = CO_SEPTIEMBRE.trim()
    .split("\n")
    .map((l) => l.split(" "));
  return {
    estacion: "centenario",
    contaminante: "co",
    mes: "2026-09",
    generado: "2026-10-05T13:00:00Z",
    ficha: [
      {
        parameter_code: "co",
        display_name: "CO",
        unidad: "ppm",
        station_name: "Centenario",
        limite_deteccion: 0.04,
        instrumentos: "THERMO 48i (serie CM23287075)",
      },
    ],
    dias: filas.map(([d, ...v]) => dia("co", Number(d), v.map(num))),
    estadisticos: (Object.keys(CO_ESTADISTICOS) as Serie[]).map((s) =>
      estadistico("co", s, CO_ESTADISTICOS[s]),
    ),
    excedencias: [
      {
        parameter_code: "co",
        norma: "Res. 68/APRA/21 Anexo I (etapa 3)",
        cita: "",
        window_code: "8h",
        is_moving: true,
        periodo_publicado: "Prom. 8 hs.",
        limite: 9,
        unidad: "ppm",
        forma_cumplimiento: null,
        n_evaluados: 720,
        n_excedencias: 0,
        // El máximo de las móviles de 8 h no está en la planilla publicada.
        maximo: null,
      },
      {
        parameter_code: "co",
        norma: "Res. 68/APRA/21 Anexo I (etapa 3)",
        cita: "",
        window_code: "1h",
        is_moving: false,
        periodo_publicado: "Prom. 1 hora",
        limite: 26,
        unidad: "ppm",
        forma_cumplimiento: null,
        n_evaluados: 716,
        n_excedencias: 0,
        maximo: 1.7,
      },
    ],
    perfil: perfil("co", 0.2),
  };
}

export function reporteNOx(): ReporteMensual {
  const params = ["no", "no2", "nox"];
  const dias = params.flatMap((p, k) =>
    Array.from({ length: 30 }, (_, i) => {
      const d = i + 1;
      if (d === 3) return dia(p, d, [null, null, null, null, null, null]);
      if (d === 4) {
        return dia(p, d, [null, 10, 11, null, 30 + k, 2], {
          prom_24h_estado: "DND",
          bloque_16_24_estado: "DND",
        });
      }
      // El NO del día 11 tiene un mínimo horario por debajo del límite (0,4 ppb).
      return dia(p, d, [
        20 + k,
        10 + k,
        25 + k,
        18 + k,
        120 + k,
        p === "no" && d === 11 ? 0.3 : 1 + k,
      ]);
    }),
  );
  return {
    estacion: "catalinas",
    contaminante: "nox",
    mes: "2026-09",
    generado: "2026-10-05T13:00:00Z",
    ficha: params.map((p) => ({
      parameter_code: p,
      display_name: p === "no2" ? "NO₂" : p.toUpperCase(),
      unidad: "ppb",
      station_name: "La Boca",
      limite_deteccion: 0.4,
      instrumentos: "THERMO 42i (serie CM23067047)",
    })),
    dias,
    estadisticos: params.flatMap((p) =>
      (["24h", "8h_0_8", "8h_8_16", "8h_16_24", "1h"] as Serie[]).map((s) =>
        s === "8h_16_24" && p === "no"
          ? estadistico(p, s, [0, 0, 0, 0, 0, 0, 0, 0])
          : estadistico(p, s, [28, 0.3, 90, 110, 125, 21.4, 12.6, 19]),
      ),
    ),
    excedencias: [
      {
        parameter_code: "no2",
        norma: "Res. 68/APRA/21 Anexo I (etapa 3)",
        cita: "",
        window_code: "1h",
        is_moving: false,
        periodo_publicado: "Prom. 1 hora",
        limite: 106,
        unidad: "ppb",
        forma_cumplimiento:
          "etapa 3: percentil 98 anual de las medias de 1 hora consecutiva",
        n_evaluados: 690,
        n_excedencias: 3,
        maximo: 125,
      },
    ],
    perfil: params.flatMap((p, k) => perfil(p, 10 * (k + 1))),
  };
}
