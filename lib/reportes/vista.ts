/**
 * @file Lectura del ReporteMensual por parámetro, para las plantillas.
 * @description Las funciones de `reporte` devuelven formato largo (una fila por
 * parámetro y día, por parámetro y serie, ...). Las plantillas piden "los días
 * del NO2" o "el P95 de las horas del CO": esto lo resuelve en un solo lugar.
 */

import { CONTAMINANTES, ESTACIONES, nombreDelMes } from "./config";
import { sinSubindices } from "./formato";
import type {
  CeldaPerfil,
  Dia,
  Estadistico,
  Excedencia,
  GrupoPerfil,
  ReporteMensual,
  Serie,
} from "./models";

export const TZ = "America/Argentina/Buenos_Aires";

export function vista(r: ReporteMensual) {
  const cfg = CONTAMINANTES[r.contaminante];
  const estacion = ESTACIONES[r.estacion];
  const params = cfg.parametros;
  const varios = params.length > 1;

  const ficha = (p: string) => r.ficha.find((f) => f.parameter_code === p);
  const nombre = (p: string) =>
    sinSubindices(ficha(p)?.display_name ?? p.toUpperCase());
  const ld = (p: string) => ficha(p)?.limite_deteccion ?? null;
  const dias = (p: string): Dia[] =>
    r.dias.filter((d) => d.parameter_code === p);
  const estadistico = (p: string, s: Serie): Estadistico | undefined =>
    r.estadisticos.find((e) => e.parameter_code === p && e.serie === s);
  const excedencias = (p?: string): Excedencia[] =>
    r.excedencias.filter((e) => p === undefined || e.parameter_code === p);
  const perfil = (
    p: string,
    g: GrupoPerfil,
    hora: number,
  ): CeldaPerfil | undefined =>
    r.perfil.find(
      (c) => c.parameter_code === p && c.grupo === g && c.hora_inicio === hora,
    );

  /** El límite de una ventana, si UN solo parámetro del reporte lo tiene. */
  const limiteDe = (ventana: "1h" | "8h" | "24h") => {
    const ls = r.excedencias.filter((e) => e.window_code === ventana);
    return ls.length === 1 ? ls[0] : undefined;
  };

  const numeroDeDias = dias(params[0]).length;
  // "05/10/2026 10:00", en hora argentina y 24 hs (sin "a. m.").
  const partes = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TZ,
  }).formatToParts(new Date(r.generado));
  const parte = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  const generado = `${parte("day")}/${parte("month")}/${parte("year")} ${parte("hour")}:${parte("minute")}`;

  return {
    cfg,
    estacion,
    params,
    varios,
    mesTitulo: nombreDelMes(r.mes),
    ficha,
    nombre,
    ld,
    dias,
    estadistico,
    excedencias,
    perfil,
    limiteDe,
    numeroDeDias,
    generado,
  };
}

export type Vista = ReturnType<typeof vista>;

// Colores de las series cuando el reporte trae varios parámetros, en el orden
// de la planilla de NOx: NO verde, NO2 amarillo, NOx magenta.
export const COLORES_PARAMETRO = ["#5ea500", "#f0b400", "#e6008a", "#1f4fd1"];
