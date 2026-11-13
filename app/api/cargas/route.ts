import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import { CargarSchema, ListarSchema } from "@/lib/carga/models";
import { listarCargas, registrarCarga } from "@/lib/carga/repository";
import { CargaRechazada, traducirError } from "@/lib/carga/service";
import { extractQueryParams } from "@/lib/datos/utils";
import { puedeRevisar } from "@/lib/revision/service";

export const dynamic = "force-dynamic";

// GET /api/cargas?station_code=&estado=vigentes|todas
// El listado lo ve cualquiera con sesión: saber qué horas vienen de una carga
// manual es parte de leer los datos.
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
    return NextResponse.json(await listarCargas(parsed.data));
  } catch (error) {
    console.error("Error listando cargas:", error);
    return NextResponse.json(
      { error: "Error interno al listar las cargas" },
      { status: 500 },
    );
  }
}

// POST /api/cargas — registra un lote de promedios horarios de una estación.
// Mismo permiso que la revisión manual: EDITOR o ADMIN vigente. Quién carga lo
// pone la sesión, no el cuerpo; el origen es siempre `portal`.
export async function POST(request: NextRequest) {
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

  const parsed = CargarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const carga_id = await registrarCarga(parsed.data, sesion.email);
    return NextResponse.json({ carga_id }, { status: 201 });
  } catch (error) {
    const traducido = traducirError(error);
    if (traducido instanceof CargaRechazada) {
      return NextResponse.json({ error: traducido.message }, { status: 400 });
    }
    console.error("Error registrando una carga:", error);
    return NextResponse.json(
      { error: "Error interno al registrar la carga" },
      { status: 500 },
    );
  }
}
