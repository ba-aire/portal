import "server-only";

import { queryAiredb } from "@/db/airedb";
import type {
  CeldaPerfil,
  Dia,
  Estadistico,
  Excedencia,
  FichaParametro,
} from "./models";

// El reporte mensual sale de las funciones del schema `reporte` de airedb
// (ba-aire/data, V20 y R__reporte_mensual.sql). Acá no se calcula nada: cada
// función devuelve un bloque del reporte ya resuelto, con el mes en hora de
// Buenos Aires y solo valores válidos de gold. Qué es cada columna, en el
// COMMENT y la cabecera de esas funciones.
//
// Las tres entradas viajan como parámetros: $1 estación (station_code), $2 los
// parameter_code (text[]) y $3 un día del mes (date). Los numeric se castean a
// float8: node-postgres devuelve numeric como string.

type Args = [string, string[], string];

const SQL_FICHA = `
  SELECT parameter_code, display_name, unidad, station_name,
         limite_deteccion::float8 AS limite_deteccion, instrumentos
  FROM reporte.mensual_ficha($1, $2::text[], $3::date)`;

const SQL_DIAS = `
  SELECT parameter_code, fecha::text AS fecha, dia,
         prom_24h::float8     AS prom_24h,     prom_24h_estado,
         bloque_0_8::float8   AS bloque_0_8,   bloque_0_8_estado,
         bloque_8_16::float8  AS bloque_8_16,  bloque_8_16_estado,
         bloque_16_24::float8 AS bloque_16_24, bloque_16_24_estado,
         max_1h::float8 AS max_1h, min_1h::float8 AS min_1h,
         horas_estado, n_horas_validas
  FROM reporte.mensual_dias($1, $2::text[], $3::date)`;

const SQL_ESTADISTICOS = `
  SELECT parameter_code, serie, n,
         minimo::float8 AS minimo, p95::float8 AS p95, p98::float8 AS p98,
         maximo::float8 AS maximo, media::float8 AS media,
         desvio::float8 AS desvio, mediana::float8 AS mediana
  FROM reporte.mensual_estadisticos($1, $2::text[], $3::date)`;

const SQL_EXCEDENCIAS = `
  SELECT parameter_code, norma, cita, window_code, is_moving, periodo_publicado,
         limite::float8 AS limite, unidad, forma_cumplimiento,
         n_evaluados, n_excedencias, maximo::float8 AS maximo
  FROM reporte.mensual_excedencias($1, $2::text[], $3::date)`;

const SQL_PERFIL = `
  SELECT parameter_code, hora_inicio, grupo, valor::float8 AS valor, n
  FROM reporte.mensual_perfil_horario($1, $2::text[], $3::date)`;

export const fetchFicha = (...a: Args) =>
  queryAiredb<FichaParametro>(SQL_FICHA, a);
export const fetchDias = (...a: Args) => queryAiredb<Dia>(SQL_DIAS, a);
export const fetchEstadisticos = (...a: Args) =>
  queryAiredb<Estadistico>(SQL_ESTADISTICOS, a);
export const fetchExcedencias = (...a: Args) =>
  queryAiredb<Excedencia>(SQL_EXCEDENCIAS, a);
export const fetchPerfil = (...a: Args) =>
  queryAiredb<CeldaPerfil>(SQL_PERFIL, a);
