import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { extractQueryParams } from "@/lib/datos/utils";
import { ListarSchema, RegistrarSchema } from "@/lib/revision/models";
import { listarRevisiones, registrarRevision } from "@/lib/revision/repository";
import {
  esEditorVigente,
  RevisionRechazada,
  traducirError,
} from "@/lib/revision/service";

export const dynamic = "force-dynamic";

// GET /api/revisiones?station_code=&estado=vigentes|todas&desde=&hasta=
// El listado lo ve cualquiera con sesión: saber qué se invalidó y por qué es
// parte de leer los datos.
export async function GET(request: NextRequest) {
  // El matcher de proxy.ts excluye /api, así que la sesión se verifica acá.
  if (!(await getSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = ListarSchema.safeParse(extractQueryParams(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await listarRevisiones(parsed.data));
  } catch (error) {
    console.error("Error listando revisiones:", error);
    return NextResponse.json(
      { error: "Error interno al listar las revisiones" },
      { status: 500 },
    );
  }
}

// POST /api/revisiones — registra una invalidación o una reincorporación.
// Solo un EDITOR vigente. Quién registra lo pone la sesión, no el cuerpo.
export async function POST(request: NextRequest) {
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

  const parsed = RegistrarSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const revision_id = await registrarRevision(parsed.data, sesion.email);
    return NextResponse.json({ revision_id }, { status: 201 });
  } catch (error) {
    const traducido = traducirError(error);
    if (traducido instanceof RevisionRechazada) {
      return NextResponse.json({ error: traducido.message }, { status: 400 });
    }
    console.error("Error registrando una revisión:", error);
    return NextResponse.json(
      { error: "Error interno al registrar la revisión" },
      { status: 500 },
    );
  }
}
