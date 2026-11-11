import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { IndiceEnum } from "@/lib/ica/models";
import { getIca } from "@/lib/ica/service";

export const dynamic = "force-dynamic";

// GET /api/ica?indice=EPA|EEA
// El índice de calidad del aire de cada estación y de la Ciudad, en la última
// hora que tenga gold.
export async function GET(request: NextRequest) {
  // El matcher de proxy.ts excluye /api, así que la sesión se verifica acá.
  if (!(await getSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Sin parámetro se asume EPA, que es el índice de referencia. Uno que no
  // existe es un 400: no se cae a un default en silencio, porque el cliente
  // estaría mostrando un índice distinto del que cree.
  const parsed = IndiceEnum.safeParse(
    request.nextUrl.searchParams.get("indice") ?? "EPA",
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Índice inválido: se espera EPA o EEA" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await getIca(parsed.data));
  } catch (error) {
    // Se loguea completo del lado del servidor; al cliente, un mensaje genérico
    // (error.message puede traer SQL y nombres de tabla).
    console.error("Error fetching ICA:", error);
    return NextResponse.json(
      { error: "Error interno al obtener el índice" },
      { status: 500 },
    );
  }
}
