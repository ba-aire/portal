import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { BASE_PATH } from "@/lib/base-path";
import {
  type Contaminante,
  ESTACIONES,
  type Estacion,
  type Plantilla,
} from "./config";

/**
 * @file Del reporte en HTML al PDF.
 * @description El reporte es UNA página del portal (`/imprimir/reporte-mensual`)
 * que se ve igual en pantalla y en papel. El PDF lo imprime Chromium en el
 * servidor, a través de Gotenberg (un contenedor aparte en la VM): el portal le
 * pasa la URL de esa página y Gotenberg devuelve el PDF.
 *
 * Gotenberg no tiene la cookie del usuario. Entra con un TOKEN firmado con
 * SESSION_SECRET que dice exactamente qué reporte puede ver y vence en dos
 * minutos. No es una sesión (no trae userId: decrypt() de auth-session no lo
 * acepta como tal) y no sirve para otro reporte.
 */

export type ReportePedido = {
  estacion: Estacion;
  contaminante: Contaminante;
  mes: string;
  plantilla: Plantilla;
};

const AUDIENCIA = "imprimir-reporte-mensual";

function clave(): Uint8Array {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) throw new Error("SESSION_SECRET no está definida.");
  return new TextEncoder().encode(secreto);
}

/** Token para que Gotenberg abra ESTE reporte, durante dos minutos. */
export async function firmarToken(p: ReportePedido): Promise<string> {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCIA)
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(clave());
}

/** true si el token es válido y es para exactamente este reporte. */
export async function tokenValido(
  token: string,
  p: ReportePedido,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, clave(), {
      algorithms: ["HS256"],
      audience: AUDIENCIA,
    });
    return (
      payload.estacion === p.estacion &&
      payload.contaminante === p.contaminante &&
      payload.mes === p.mes &&
      payload.plantilla === p.plantilla
    );
  } catch {
    return false;
  }
}

/** La consulta de la página del reporte, sin el token. */
export function consultaDe(p: ReportePedido): URLSearchParams {
  return new URLSearchParams({
    estacion: p.estacion,
    contaminante: p.contaminante,
    mes: p.mes,
    plantilla: p.plantilla,
  });
}

/** La ruta de la página del reporte dentro del portal (con el basePath). */
export function rutaDelReporte(p: ReportePedido): string {
  return `${BASE_PATH}/imprimir/reporte-mensual?${consultaDe(p)}`;
}

export class ImpresionNoConfigurada extends Error {}

/**
 * El PDF del reporte, impreso por Gotenberg.
 *
 * GOTENBERG_URL       dónde escucha Gotenberg (VM: el contenedor; dev:
 *                     http://localhost:3001)
 * PORTAL_URL_INTERNA  cómo llega Gotenberg al portal, SIN el basePath (VM: el
 *                     contenedor del portal; dev: http://host.docker.internal:3000)
 */
export async function generarPdf(p: ReportePedido): Promise<Buffer> {
  const gotenberg = process.env.GOTENBERG_URL;
  const portal = process.env.PORTAL_URL_INTERNA;
  if (!gotenberg || !portal) {
    throw new ImpresionNoConfigurada(
      "Faltan GOTENBERG_URL o PORTAL_URL_INTERNA: no hay dónde imprimir el PDF.",
    );
  }
  const consulta = consultaDe(p);
  consulta.set("token", await firmarToken(p));

  const form = new FormData();
  form.set("url", `${portal}${BASE_PATH}/imprimir/reporte-mensual?${consulta}`);
  // El tamaño y los márgenes los manda la página (@page): las hojas ya están
  // armadas en A4, con su pie y su número.
  form.set("preferCssPageSize", "true");
  form.set("printBackground", "true");
  for (const lado of ["Top", "Bottom", "Left", "Right"]) {
    form.set(`margin${lado}`, "0");
  }
  // Imprimir recién cuando están las hojas y la tipografía cargó (si no,
  // Chromium usa la de reemplazo y el texto se corre). Las hojas, porque una
  // página sin autorización no es un 401: Next ya empezó a transmitir (hay un
  // loading.tsx en la raíz) y el redirect a /login sale como 200 con un meta
  // refresh. Sin esta condición Gotenberg imprimiría el login; con ella, falla.
  form.set(
    "waitForExpression",
    "document.fonts.status === 'loaded' && document.querySelector('.hoja') !== null",
  );

  const res = await fetch(`${gotenberg}/forms/chromium/convert/url`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(
      `Gotenberg respondió ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * "pm10_centenario_septiembre_2026_clasico.pdf": el nombre de los PDF que ya se
 * publican (contaminante, estación, mes), más la plantilla.
 */
export function nombreDeArchivo(p: ReportePedido): string {
  const [anio, mes] = p.mes.split("-");
  const meses = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    timeZone: "UTC",
  });
  const nombreMes = meses.format(
    new Date(Date.UTC(Number(anio), Number(mes) - 1, 15)),
  );
  const estacion = ESTACIONES[p.estacion].nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^parque /, "")
    .replace(/\s+/g, "_");
  return `${p.contaminante}_${estacion}_${nombreMes}_${anio}_${p.plantilla}.pdf`;
}
