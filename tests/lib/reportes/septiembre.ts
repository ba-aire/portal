// Septiembre de 2026 en Parque Centenario, transcripto de los tres PDF
// publicados (planilla Excel): CO, NOx y PM10. Hoja 1 (tabla diaria y
// estadísticos) y hoja 5 (perfil horario). Sirve para comparar los PDF que arma
// el portal contra los originales con los mismos números.
//
// Lo que la planilla no trae queda en null: el máximo de las móviles de 8 h del
// CO, y en el NOx los días de la semana sueltos del perfil (la planilla solo
// publica Mensual, Sábado, Dom y Feri y Lun a Vier). Los "<0,5" y "<4" de la
// planilla van como un valor por debajo del límite de detección del analizador
// (0,3 y 3), así que el portal los escribe con SU límite: "<0,4" y "<4,8".
import type {
  CeldaPerfil,
  Dia,
  Estadistico,
  Excedencia,
  GrupoPerfil,
  ReporteMensual,
  Serie,
} from "@/lib/reportes/models";

const num = (s: string) =>
  s === "<0,5" ? 0.3 : s === "<4" ? 3 : Number(s.replace(",", "."));
const filas = (t: string) =>
  t
    .trim()
    .split("\n")
    .map((l) => l.trim().split(/\s+/));

const ESTADO = (x: number | null) =>
  (x === null ? "SD" : "ok") as Dia["prom_24h_estado"];

/** Tabla diaria: día, y por cada bloque (24h, 0-8, 8-16, 16-24, máx, mín) los P parámetros. */
function dias(params: string[], tabla: string): Dia[] {
  const P = params.length;
  return params.flatMap((p, k) =>
    filas(tabla).map(([d, ...v]) => {
      const col = (bloque: number) => num(v[bloque * P + k]);
      return {
        parameter_code: p,
        fecha: `2026-09-${d.padStart(2, "0")}`,
        dia: Number(d),
        prom_24h: col(0),
        prom_24h_estado: ESTADO(col(0)),
        bloque_0_8: col(1),
        bloque_0_8_estado: "ok",
        bloque_8_16: col(2),
        bloque_8_16_estado: "ok",
        bloque_16_24: col(3),
        bloque_16_24_estado: "ok",
        max_1h: col(4),
        min_1h: col(5),
        horas_estado: "ok",
        n_horas_validas: 24,
      } satisfies Dia;
    }),
  );
}

const SERIES: Serie[] = ["24h", "8h_0_8", "8h_8_16", "8h_16_24", "1h"];
const RENGLONES = [
  "n",
  "minimo",
  "p95",
  "p98",
  "maximo",
  "media",
  "desvio",
  "mediana",
] as const;

/** Estadísticos: un renglón por estadístico, columnas serie × parámetro. */
function estadisticos(params: string[], tabla: string): Estadistico[] {
  const P = params.length;
  const r = filas(tabla);
  return params.flatMap((p, k) =>
    SERIES.map((serie, s) => {
      const e: Record<string, number> = {};
      RENGLONES.forEach((nombre, i) => {
        e[nombre] = num(r[i][s * P + k]);
      });
      return { parameter_code: p, serie, ...e } as Estadistico;
    }),
  );
}

/** Perfil horario: filas de 23 a 22 h, columnas grupo × parámetro. */
function perfil(
  params: string[],
  grupos: GrupoPerfil[],
  tabla: string,
): CeldaPerfil[] {
  const P = params.length;
  const orden = [23, ...Array.from({ length: 23 }, (_, i) => i)];
  const todos: GrupoPerfil[] = [
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
  const r = filas(tabla);
  return params.flatMap((p, k) =>
    todos.flatMap((grupo) =>
      orden.map((hora, h) => {
        const g = grupos.indexOf(grupo);
        return {
          parameter_code: p,
          hora_inicio: hora,
          grupo,
          valor: g < 0 ? null : num(r[h][g * P + k]),
          n: g < 0 ? 0 : 4,
        };
      }),
    ),
  );
}

const exc = (
  parameter_code: string,
  window_code: Excedencia["window_code"],
  is_moving: boolean,
  limite: number,
  unidad: string,
  n_evaluados: number,
  maximo: number | null,
): Excedencia => ({
  parameter_code,
  norma: "Res. 68/APRA/21 Anexo I (etapa 3)",
  cita: "",
  window_code,
  is_moving,
  periodo_publicado: "",
  limite,
  unidad,
  forma_cumplimiento: null,
  n_evaluados,
  n_excedencias: 0,
  maximo,
});

const ficha = (
  parameter_code: string,
  display_name: string,
  unidad: string,
  ld: number,
  instrumentos: string,
) => ({
  parameter_code,
  display_name,
  unidad,
  station_name: "Centenario",
  limite_deteccion: ld,
  instrumentos,
});

const base = {
  estacion: "centenario" as const,
  mes: "2026-09",
  generado: "2026-10-05T13:00:00Z",
};
const NUEVE: GrupoPerfil[] = [
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
const CUATRO: GrupoPerfil[] = [
  "mensual",
  "sabado",
  "domingo_feriado",
  "lunes_a_viernes",
];

// ---- CO (ppm) -------------------------------------------------------------------
export function coSeptiembre(): ReporteMensual {
  return {
    ...base,
    contaminante: "co",
    ficha: [ficha("co", "CO", "ppm", 0.04, "THERMO 48i (serie CM23287075)")],
    dias: dias(
      ["co"],
      `
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
30 0,3 0,3 0,4 0,4 0,5 0,2`,
    ),
    estadisticos: estadisticos(
      ["co"],
      `
30 30 30 30 716
0,2 0,1 0,2 0,2 0,1
0,5 0,4 0,5 0,7 0,6
0,5 0,4 0,5 0,8 0,8
0,6 0,4 0,6 0,8 1,7
0,3 0,3 0,3 0,4 0,3
0,1 0,1 0,1 0,2 0,2
0,3 0,3 0,3 0,4 0,3`,
    ),
    excedencias: [
      exc("co", "8h", true, 9, "ppm", 720, null),
      exc("co", "1h", false, 26, "ppm", 716, 1.7),
    ],
    perfil: perfil(
      ["co"],
      NUEVE,
      `
0,3 0,2 0,3 0,3 0,3 0,3 0,3 0,3 0,3
0,2 0,2 0,2 0,2 0,3 0,2 0,2 0,3 0,2
0,2 0,2 0,2 0,2 0,2 0,2 0,2 0,2 0,2
0,2 0,1 0,2 0,2 0,2 0,2 0,2 0,2 0,2
0,2 0,1 0,2 0,2 0,2 0,2 0,2 0,2 0,2
0,2 0,2 0,2 0,2 0,2 0,3 0,2 0,2 0,2
0,3 0,2 0,3 0,4 0,4 0,4 0,2 0,3 0,3
0,4 0,3 0,4 0,5 0,6 0,6 0,2 0,3 0,5
0,4 0,4 0,5 0,5 0,5 0,6 0,2 0,2 0,5
0,4 0,3 0,5 0,4 0,5 0,5 0,2 0,3 0,4
0,3 0,2 0,4 0,4 0,3 0,4 0,2 0,2 0,3
0,3 0,2 0,3 0,4 0,3 0,3 0,2 0,3 0,3
0,3 0,3 0,4 0,4 0,3 0,3 0,2 0,2 0,3
0,3 0,3 0,3 0,3 0,3 0,3 0,3 0,3 0,3
0,3 0,3 0,4 0,3 0,3 0,3 0,3 0,3 0,3
0,3 0,3 0,3 0,3 0,3 0,3 0,3 0,3 0,3
0,3 0,3 0,3 0,4 0,3 0,3 0,3 0,3 0,3
0,3 0,3 0,4 0,4 0,3 0,4 0,3 0,2 0,4
0,4 0,4 0,4 0,5 0,5 0,5 0,3 0,3 0,4
0,5 0,4 0,5 0,5 0,6 0,6 0,3 0,3 0,5
0,5 0,4 0,5 0,6 0,8 0,7 0,4 0,4 0,6
0,5 0,4 0,4 0,6 0,5 0,7 0,4 0,4 0,5
0,5 0,3 0,4 0,5 0,5 0,6 0,4 0,4 0,5
0,4 0,2 0,3 0,4 0,4 0,4 0,3 0,3 0,4`,
    ),
  };
}

// ---- NOx (ppb): NO, NO2, NOx ----------------------------------------------------
export function noxSeptiembre(): ReporteMensual {
  const P = ["no", "no2", "nox"];
  return {
    ...base,
    contaminante: "nox",
    ficha: [
      ficha("no", "NO", "ppb", 0.4, "THERMO 42i (serie CM24357014)"),
      ficha("no2", "NO₂", "ppb", 0.4, "THERMO 42i (serie CM24357014)"),
      ficha("nox", "NOₓ", "ppb", 0.4, "THERMO 42i (serie CM24357014)"),
    ],
    dias: dias(
      P,
      `
1 19 16 36 8 12 20 27 18 45 23 19 41 39 24 61 2 8 10
2 34 13 47 8 7 15 34 13 46 60 21 81 104 23 126 1 4 6
3 34 14 48 21 9 30 48 16 64 35 16 50 100 24 121 1 4 5
4 44 15 59 38 11 49 44 14 59 48 21 69 131 26 145 3 8 12
5 12 10 22 7 9 17 15 9 25 14 13 26 23 17 40 2 7 9
6 6 9 15 4 7 11 5 6 12 7 14 22 16 17 32 2 4 6
7 16 13 29 13 12 25 18 12 30 17 16 33 37 21 55 2 5 6
8 6 14 33 6 9 24 6 13 43 6 19 31 6 23 86 6 5 6
9 24 17 42 22 15 37 23 15 38 28 22 50 54 26 76 3 11 14
10 27 15 42 44 11 55 30 15 44 6 19 25 193 23 211 2 6 8
11 26 19 44 31 14 45 37 21 59 9 20 29 178 28 201 <0,5 7 8
12 5 9 14 2 7 9 7 9 16 7 11 17 13 13 24 1 5 5
13 6 11 16 4 10 14 5 7 13 8 15 23 13 18 29 2 6 8
14 31 15 46 29 11 41 23 12 35 40 23 63 140 29 163 <0,5 5 5
15 24 13 37 28 14 43 39 15 54 5 11 16 117 20 137 1 9 10
16 8 14 22 7 12 19 12 12 25 7 18 24 38 25 63 <0,5 6 7
17 39 18 57 18 11 29 36 15 51 63 29 92 145 35 180 1 7 8
18 24 19 42 19 15 34 19 16 35 34 25 59 56 27 83 2 9 10
19 8 16 24 4 12 17 13 13 26 8 22 30 19 25 39 1 8 9
20 9 11 20 6 11 17 8 9 16 14 13 27 29 18 45 3 7 11
21 16 9 25 8 8 16 23 9 32 17 11 27 29 12 41 1 4 6
22 39 13 52 12 7 19 37 13 50 69 19 88 107 24 131 1 4 5
23 23 14 37 14 13 27 28 13 41 26 17 43 63 20 79 2 8 10
24 24 16 40 15 11 25 30 16 46 27 21 48 46 27 69 1 7 8
25 38 18 56 24 13 37 42 18 61 47 23 70 106 25 128 1 8 9
26 3 9 13 2 10 12 5 8 13 3 10 12 8 18 25 1 6 7
27 3 7 10 1 5 6 3 7 11 6 8 14 8 11 18 <0,5 4 4
28 8 10 18 2 5 7 12 12 24 9 13 22 17 18 34 1 3 4
29 24 11 35 13 7 19 36 12 48 22 14 36 48 16 58 1 5 6
30 22 12 34 11 8 19 34 14 48 21 13 34 54 17 69 1 5 6`,
    ),
    estadisticos: estadisticos(
      P,
      `
30 30 30 30 30 30 30 30 30 30 30 30 717 717 717
3 7 10 1 5 6 3 6 11 3 8 12 <0,5 3 4
39 18 57 35 15 47 43 18 60 62 24 85 63 24 84
41 19 58 41 15 51 46 20 62 66 27 90 94 27 116
44 19 59 44 15 55 48 21 64 69 29 92 193 35 211
20 13 34 14 10 25 23 13 37 23 17 40 20 13 34
12 3 14 11 3 13 14 4 16 19 5 22 24 6 28
22 13 35 11 11 20 23 13 40 17 17 32 12 13 27`,
    ),
    excedencias: [exc("no2", "1h", false, 106, "ppb", 717, 35)],
    perfil: perfil(
      P,
      CUATRO,
      `
7 12 19 5 14 19 4 10 15 7 12 20
3 10 13 2 12 14 2 9 11 3 10 13
2 8 10 3 10 13 2 8 10 2 8 10
2 7 9 1 8 9 2 7 9 2 7 9
3 7 10 2 7 8 2 6 9 4 7 11
12 10 21 4 7 11 3 7 11 14 10 25
32 13 46 5 8 13 8 8 16 41 15 57
51 15 68 10 11 20 6 9 15 67 17 87
40 15 57 11 11 21 6 7 13 51 18 72
31 14 47 9 10 19 6 8 14 39 17 58
24 13 38 9 9 19 3 7 10 31 15 47
21 12 33 10 9 19 5 7 12 26 14 41
19 12 31 9 9 17 6 7 12 23 13 37
17 11 29 10 10 20 4 7 11 21 13 34
18 12 30 10 11 21 6 8 14 21 13 35
16 13 29 11 12 22 6 10 16 19 14 33
18 14 32 8 12 20 6 8 14 22 15 38
18 15 34 8 12 20 6 9 16 22 17 39
22 18 40 7 14 21 8 11 19 28 20 48
28 19 48 7 15 21 11 13 24 36 21 57
34 19 53 10 16 26 12 14 26 42 21 63
26 19 45 11 15 26 9 15 24 32 20 52
23 18 42 7 14 21 10 16 26 28 19 48
13 15 28 4 11 15 8 14 23 15 16 31`,
    ),
  };
}

// ---- PM10 (µg/m³) ----------------------------------------------------------------
export function pm10Septiembre(): ReporteMensual {
  return {
    ...base,
    contaminante: "pm10",
    ficha: [
      ficha("pm10", "PM₁₀", "ug/m3", 4.8, "ECOTECH BAM1020 (serie U19996)"),
    ],
    dias: dias(
      ["pm10"],
      `
1 26 21 32 26 41 8
2 20 12 20 27 36 9
3 17 13 19 18 29 7
4 21 18 18 28 44 8
5 21 17 25 22 34 12
6 16 14 17 17 22 12
7 15 13 15 17 31 <4
8 17 10 21 21 32 7
9 24 14 33 26 98 8
10 20 14 21 24 33 10
11 29 16 43 29 54 11
12 20 19 23 18 31 12
13 15 16 16 13 23 9
14 15 11 14 22 35 6
15 29 19 39 29 46 9
16 25 22 27 25 37 16
17 28 17 25 41 59 14
18 25 18 29 29 34 14
19 27 18 30 34 39 13
20 20 24 23 13 36 0
21 27 20 41 19 57 9
22 19 15 21 21 27 6
23 21 18 23 22 28 14
24 26 19 32 28 36 16
25 36 32 40 37 58 17
26 17 18 15 17 32 9
27 15 19 16 10 31 6
28 12 9 13 14 19 7
29 10 8 11 11 19 4
30 15 10 21 14 26 6`,
    ),
    estadisticos: estadisticos(
      ["pm10"],
      `
30 30 30 30 720
10 8 11 10 2
29 23 40 36 39
32 27 42 39 46
36 32 43 41 98
21 16 24 22 21
6 5 9 8 10
20 17 22 22 19`,
    ),
    excedencias: [exc("pm10", "24h", false, 100, "ug/m3", 30, 36)],
    perfil: perfil(
      ["pm10"],
      NUEVE,
      `
17 14 15 16 18 18 21 19 16
15 13 15 13 18 16 18 17 15
15 8 14 13 13 17 23 15 13
14 8 12 13 14 17 18 16 13
13 9 10 14 12 18 14 15 13
17 14 13 16 13 25 18 22 16
19 20 16 17 17 25 16 22 19
21 20 19 20 20 32 18 20 22
24 20 25 25 20 42 19 19 26
25 21 25 26 24 37 27 18 26
27 21 25 38 24 40 23 19 30
25 19 26 23 30 37 23 16 27
22 22 24 21 23 29 21 14 24
23 20 24 23 23 26 24 18 23
24 25 27 24 25 26 24 18 25
22 18 23 19 27 24 23 22 22
22 16 24 22 24 29 20 15 23
20 16 24 20 23 25 22 12 22
20 15 21 21 25 25 25 11 21
23 22 22 24 30 26 21 12 25
24 18 20 23 37 33 25 13 26
24 20 21 24 31 36 26 12 26
24 20 22 24 27 39 22 16 26
21 15 18 22 26 32 21 15 22`,
    ),
  };
}
