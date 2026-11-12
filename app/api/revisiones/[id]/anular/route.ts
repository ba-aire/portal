import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { AnularSchema, RevisionIdSchema } from "@/lib/revision/models";
import { anularRevision } from "@/lib/revision/repository";
import {
  esEditorVigente,
  RevisionRechazada,
  traducirError,
} from "@/lib/revision/service";

export const dynamic = "force-dynamic";

// POST /api/revisiones/:id/anular — deja sin efecto una revisión. No borra
// nada: la tabla es append-only y la anulación es otra fila, con su motivo.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const sesion = await getSession();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await esEditorVigente(sesion.email, sesion.role))) {
    return NextResponse.json(
      { error: "Solo un editor puede revisar datos" },
      { status: 403 },
    );
  }

  const id = RevisionIdSchema.safeParse((await context.params).id);
  if (!id.success) {
    return NextResponse.json(
      { error: "Revisión inexistente" },
      { status: 404 },
    );
  }
  const parsed = AnularSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const revision_id = await anularRevision(
      id.data,
      parsed.data.motivo,
      sesion.email,
    );
    return NextResponse.json({ revision_id }, { status: 201 });
  } catch (error) {
    const traducido = traducirError(error);
    if (traducido instanceof RevisionRechazada) {
      return NextResponse.json({ error: traducido.message }, { status: 400 });
    }
    console.error("Error anulando una revisión:", error);
    return NextResponse.json(
      { error: "Error interno al anular la revisión" },
      { status: 500 },
    );
  }
}
