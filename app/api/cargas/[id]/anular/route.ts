import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { AnularSchema, CargaIdSchema } from "@/lib/carga/models";
import { anularCarga } from "@/lib/carga/repository";
import { CargaRechazada, traducirError } from "@/lib/carga/service";
import { puedeRevisar } from "@/lib/revision/service";

export const dynamic = "force-dynamic";

// POST /api/cargas/:id/anular — deja sin efecto una carga ENTERA. No borra
// nada: las tablas son append-only y la anulación es otra fila, con su motivo.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const sesion = await getSession();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await puedeRevisar(sesion.email, sesion.role))) {
    return NextResponse.json(
      { error: "Solo un editor o un administrador puede cargar datos" },
      { status: 403 },
    );
  }

  const id = CargaIdSchema.safeParse((await context.params).id);
  if (!id.success) {
    return NextResponse.json({ error: "Carga inexistente" }, { status: 404 });
  }
  const parsed = AnularSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const carga_id = await anularCarga(
      id.data,
      parsed.data.motivo,
      sesion.email,
    );
    return NextResponse.json({ carga_id }, { status: 201 });
  } catch (error) {
    const traducido = traducirError(error);
    if (traducido instanceof CargaRechazada) {
      return NextResponse.json({ error: traducido.message }, { status: 400 });
    }
    console.error("Error anulando una carga:", error);
    return NextResponse.json(
      { error: "Error interno al anular la carga" },
      { status: 500 },
    );
  }
}
