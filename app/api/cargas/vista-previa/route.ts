import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { VistaPreviaSchema } from "@/lib/carga/models";
import { fetchVistaPrevia } from "@/lib/carga/repository";

export const dynamic = "force-dynamic";

// POST /api/cargas/vista-previa — qué trae el lote y qué pisa (horas que gold
// ya publica válidas, horas ya cargadas). Solo lee: alcanza con tener sesión.
export async function POST(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = VistaPreviaSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await fetchVistaPrevia(parsed.data));
  } catch (error) {
    console.error("Error en la vista previa de una carga:", error);
    return NextResponse.json(
      { error: "Error interno al calcular la vista previa" },
      { status: 500 },
    );
  }
}
