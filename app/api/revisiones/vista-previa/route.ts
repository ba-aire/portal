import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { VistaPreviaSchema } from "@/lib/revision/models";
import { fetchVistaPrevia } from "@/lib/revision/repository";

export const dynamic = "force-dynamic";

// POST /api/revisiones/vista-previa — qué hay hoy en el período que se va a
// revisar. Solo lee: alcanza con tener sesión. POST y no GET porque es el mismo
// cuerpo que el alta.
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
    console.error("Error en la vista previa de una revisión:", error);
    return NextResponse.json(
      { error: "Error interno al calcular la vista previa" },
      { status: 500 },
    );
  }
}
