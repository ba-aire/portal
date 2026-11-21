import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import {
  generarPdf,
  ImpresionNoConfigurada,
  nombreDeArchivo,
} from "@/lib/reportes/impresion";
import { ConsultaReporteSchema } from "@/lib/reportes/models";
import { getReporteMensual } from "@/lib/reportes/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/reportes/mensual?estacion=centenario&contaminante=co&mes=2026-09
//     [&formato=json|pdf][&plantilla=clasico|nuevo]
// El reporte mensual de una estación y un contaminante: los números en JSON o
// el PDF en la plantilla pedida (la página /imprimir/reporte-mensual impresa
// por Chromium en Gotenberg).
export async function GET(request: NextRequest) {
  // El matcher de proxy.ts excluye /api, así que la sesión se verifica acá.
  if (!(await getSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = ConsultaReporteSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Parámetros inválidos",
        detalle: parsed.error.issues.map((i) => i.message),
      },
      { status: 400 },
    );
  }
  const { estacion, contaminante, mes, formato, plantilla } = parsed.data;

  try {
    if (formato === "json") {
      return NextResponse.json(
        await getReporteMensual(estacion, contaminante, mes, plantilla),
      );
    }

    const pedido = { estacion, contaminante, mes, plantilla };
    const pdf = await generarPdf(pedido);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreDeArchivo(pedido)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ImpresionNoConfigurada) {
      console.error(error.message);
      return NextResponse.json(
        { error: "La impresión de PDF no está configurada en este servidor" },
        { status: 503 },
      );
    }
    // Completo en el log del servidor; al cliente, un mensaje genérico
    // (error.message puede traer SQL y nombres de tabla).
    console.error("Error armando el reporte mensual:", error);
    return NextResponse.json(
      { error: "Error interno al armar el reporte" },
      { status: 500 },
    );
  }
}
