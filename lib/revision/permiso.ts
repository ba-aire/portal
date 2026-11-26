import { NextResponse } from "next/server";
import type { SessionPayload } from "@/lib/auth-session";
import { puedeRevisar } from "@/lib/revision/service";

/**
 * El chequeo de permiso de las rutas que escriben en airedb (/api/revisiones y
 * /api/cargas, alta y anulación): `null` si la sesión puede escribir, o la
 * respuesta con la que la ruta tiene que cortar.
 *
 * `puedeRevisar` va a la base `portal`, y esa consulta también puede fallar
 * (la base caída, inexistente, una password que no coincide). Sin este catch la
 * excepción escapaba de la ruta: Next respondía un 500 en HTML, el cliente no
 * podía leerlo como JSON y mostraba "Error inesperado", y el error real no
 * quedaba en el log con contexto. Ahora es un 500 en JSON, como los demás
 * errores de estas rutas, y se loguea.
 *
 * Que la verificación falle NUNCA deja pasar: sin respuesta de la base de
 * usuarios no se escribe.
 */
export async function rechazoDePermiso(
  sesion: Pick<SessionPayload, "email" | "role">,
  mensajeProhibido: string,
): Promise<NextResponse | null> {
  let puede: boolean;
  try {
    puede = await puedeRevisar(sesion.email, sesion.role);
  } catch (error) {
    console.error("Error verificando el usuario en la base portal:", error);
    return NextResponse.json(
      { error: "No se pudo verificar tu usuario. Probá de nuevo más tarde." },
      { status: 500 },
    );
  }
  if (!puede) {
    return NextResponse.json({ error: mensajeProhibido }, { status: 403 });
  }
  return null;
}
