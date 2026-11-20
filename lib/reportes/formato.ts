/**
 * @file Cómo se escribe cada número del reporte mensual.
 * @description Funciones puras, sin dependencias de servidor: las usan las dos
 * plantillas del PDF y la vista previa del navegador, así que los tres muestran
 * lo mismo. Las reglas:
 *   - coma decimal (es-AR) y redondeo "half away from zero", como ROUND de Excel
 *   - SD / DND cuando la ventana no tiene valor (reporte.estado() en data)
 *   - "<LD" para una HORA por debajo del límite de detección del analizador
 *     (dim.models.limite_deteccion). Solo para valores de una hora: un promedio
 *     de 8 o 24 horas no es una lectura del equipo y se publica como sale.
 */

import type { Estado, Excedencia, GrupoPerfil, Serie } from "./models";

/** Redondea como ROUND de Excel: 0,25 → 0,3 y -0,25 → -0,3. */
export function redondear(valor: number, decimales: number): number {
  const f = 10 ** decimales;
  // El épsilon relativo corrige 1,005 * 100 = 100,49999...
  return (Math.sign(valor) * Math.round(Math.abs(valor) * f * (1 + 1e-12))) / f;
}

/** Número con coma decimal y los decimales justos; vacío si no hay. */
export function numero(valor: number | null, decimales: number): string {
  if (valor === null || Number.isNaN(valor)) return "";
  const r = redondear(valor, decimales);
  // -0 sale "0": un valor chiquito negativo redondeado no lleva signo.
  return (Object.is(r, -0) ? 0 : r).toLocaleString("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: false,
  });
}

/** El límite de detección como se escribe en la celda: "<0,4", "<4,8". */
export function menorQueLD(ld: number): string {
  return `<${ld.toLocaleString("es-AR", { maximumFractionDigits: 2, useGrouping: false })}`;
}

/** Celda de un promedio (24 h, bloque de 8 h): el número, o SD / DND. */
export function celda(
  valor: number | null,
  estado: Estado,
  decimales: number,
): string {
  if (estado !== "ok" || valor === null) return estado === "ok" ? "" : estado;
  return numero(valor, decimales);
}

/**
 * Celda de un valor de UNA hora (máximo, mínimo, estadísticos de las horas):
 * el número, "<LD" si está por debajo del límite de detección, o SD / DND.
 */
export function celdaHora(
  valor: number | null,
  estado: Estado,
  limiteDeteccion: number | null,
  decimales: number,
): string {
  if (estado !== "ok") return estado;
  if (valor === null) return "";
  if (limiteDeteccion !== null && valor < limiteDeteccion) {
    return menorQueLD(limiteDeteccion);
  }
  return numero(valor, decimales);
}

// ---- Rótulos -------------------------------------------------------------------

/**
 * "NO₂" → "NO2", "NOₓ" → "NOx": la tipografía estándar del PDF no trae
 * subíndices. dim.parameters usa los dígitos y la "ₓ" del NOx.
 */
export function sinSubindices(texto: string): string {
  return texto
    .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - "₀".charCodeAt(0)))
    .replace(/ₓ/g, "x");
}

const UNIDADES: Record<string, string> = {
  ppm: "PPM",
  ppb: "PPB",
  "ug/m3": "µg/m³",
};

/** La unidad de dim.parameters como se imprime: "ug/m3" → "µg/m³". */
export function unidadImpresa(unidad: string): string {
  return UNIDADES[unidad] ?? unidad;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * El intervalo de una hora del perfil: 23 → "23:00 a 00:00". El número es la
 * hora en que EMPIEZA (gold rotula cada hora por su inicio).
 */
export function etiquetaHora(horaInicio: number): string {
  return `${dosDigitos(horaInicio)}:00 a ${dosDigitos((horaInicio + 1) % 24)}:00`;
}

/**
 * El orden de las filas del perfil horario, como la planilla: empieza en
 * "23:00 a 00:00" y termina en "22:00 a 23:00".
 */
export const ORDEN_HORAS_PERFIL = [
  23,
  ...Array.from({ length: 23 }, (_, i) => i),
];

export const NOTA_PERFIL =
  "Cada fila es el promedio de las horas válidas del intervalo indicado, en hora de Buenos Aires: " +
  "«23:00 a 00:00» es la hora que empieza a las 23:00. En la base de datos cada hora se identifica por su hora de INICIO.";

export const GRUPOS_PERFIL: Record<GrupoPerfil, string> = {
  mensual: "Mensual",
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo_feriado: "Dom y Feri",
  lunes_a_viernes: "Lun a Vier",
};

export const SERIES: Record<Serie, string> = {
  "24h": "Promedio 24 Hs",
  "8h_0_8": "0 a 8",
  "8h_8_16": "8 a 16",
  "8h_16_24": "16 a 24",
  "1h": "Promedios 1 Hora",
};

/** La etapa de la Res. 68 que trae norma.v_limite: "(etapa 3)" → "3ra etapa". */
export function etapaDe(norma: string): string | null {
  const m = norma.match(/etapa (\d)/);
  if (!m) return null;
  const sufijo: Record<string, string> = {
    "1": "ra",
    "2": "da",
    "3": "ra",
    "4": "ta",
    "5": "ta",
  };
  return `${m[1]}${sufijo[m[1]] ?? "°"} etapa`;
}

/** El nombre de la ventana de una excedencia, para la caja de la planilla. */
export function nombreVentana(
  e: Pick<Excedencia, "window_code" | "is_moving">,
): string {
  if (e.window_code === "8h")
    return e.is_moving ? "Promedios móviles 8 hs" : "Promedios 8 hs";
  if (e.window_code === "24h") return "Promedios 24 hs";
  return "Promedios 1 hora";
}

/** "Promedios 8 hs: 9 PPM (Res. 68/APRA/21, 3ra etapa)". */
export function textoLimite(
  e: Excedencia,
  nombreParametro: string,
  varios: boolean,
): string {
  const etapa = etapaDe(e.norma);
  const quien = varios ? ` de ${nombreParametro}` : "";
  return `${nombreVentana(e)}${quien}: ${numero(e.limite, e.limite % 1 === 0 ? 0 : 1)} ${unidadImpresa(e.unidad)} (Res. 68/APRA/21${etapa ? `, ${etapa}` : ""})`;
}
