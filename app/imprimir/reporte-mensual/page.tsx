import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { ReporteClasico } from "@/lib/reportes/html/clasico";
import { ReporteNuevo } from "@/lib/reportes/html/nuevo";
import { tokenValido } from "@/lib/reportes/impresion";
import { ConsultaReporteSchema } from "@/lib/reportes/models";
import { getReporteMensual } from "@/lib/reportes/service";

/**
 * @file El reporte mensual como página: lo que se ve acá es lo que sale en el
 * PDF. Las hojas son A4 fijas (lib/reportes/html/base.tsx), así que la misma
 * página sirve para mirarla en pantalla y para que Chromium (Gotenberg) la
 * imprima.
 *
 * Queda FUERA de (main) a propósito: sin menú lateral ni layout de la app, y
 * fuera de las rutas protegidas del proxy, porque Gotenberg entra sin cookie.
 * La autorización está acá: un token de impresión para ESTE reporte
 * (lib/reportes/impresion.ts) o una sesión del portal; si no, a /login.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BA Aire - Reporte mensual",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ImprimirReporteMensual({ searchParams }: Props) {
  const params = await searchParams;
  const solo = (x: string | string[] | undefined) =>
    Array.isArray(x) ? x[0] : x;
  const parsed = ConsultaReporteSchema.safeParse({
    estacion: solo(params.estacion),
    contaminante: solo(params.contaminante),
    mes: solo(params.mes),
    plantilla: solo(params.plantilla),
  });
  if (!parsed.success) notFound();
  const { estacion, contaminante, mes, plantilla } = parsed.data;

  const token = solo(params.token);
  const autorizado =
    (token !== undefined &&
      (await tokenValido(token, { estacion, contaminante, mes, plantilla }))) ||
    Boolean(await getSession());
  if (!autorizado) redirect("/login");

  const reporte = await getReporteMensual(estacion, contaminante, mes);
  return plantilla === "nuevo" ? (
    <ReporteNuevo reporte={reporte} />
  ) : (
    <ReporteClasico reporte={reporte} />
  );
}
