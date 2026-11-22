import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth-session";
import { IndiceEnum } from "@/lib/ica/models";
import { getIca } from "@/lib/ica/service";

export const dynamic = "force-dynamic";

const UNA_HORA_MS = 60 * 60 * 1000;

// El inicio de una hora, con zona explícita ("2026-11-21T16:00:00.000Z"). gold
// rotula cada hora por su inicio: una hora que no empieza en punto no existe en
// la vista, y una sin zona se leería en la del servidor. Una hora futura
// tampoco: gold nunca tiene ni la hora en curso.
const HoraSchema = z.iso
  .datetime({ offset: true })
  .transform((s) => new Date(s))
  .refine((d) => d.getTime() % UNA_HORA_MS === 0, "no empieza en punto")
  .refine((d) => d.getTime() <= Date.now(), "es futura");

// GET /api/ica?indice=EPA|EEA[&hora=ISO]
// El índice de calidad del aire de cada estación y de la Ciudad. Sin hora, la
// última que tenga gold de cada estación; con hora, el de esa hora exacta.
export async function GET(request: NextRequest) {
  // El matcher de proxy.ts excluye /api, así que la sesión se verifica acá.
  if (!(await getSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;

  // Sin parámetro se asume EPA, que es el índice de referencia. Uno que no
  // existe es un 400: no se cae a un default en silencio, porque el cliente
  // estaría mostrando un índice distinto del que cree.
  const parsed = IndiceEnum.safeParse(params.get("indice") ?? "EPA");
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Índice inválido: se espera EPA o EEA" },
      { status: 400 },
    );
  }

  // Lo mismo con la hora: una inválida no cae a "la última", que el cliente
  // mostraría rotulada como la que pidió.
  const horaParam = params.get("hora");
  let hora: Date | null = null;
  if (horaParam !== null) {
    const parsedHora = HoraSchema.safeParse(horaParam);
    if (!parsedHora.success) {
      return NextResponse.json(
        {
          error: "Hora inválida: se espera el inicio de una hora pasada (ISO)",
        },
        { status: 400 },
      );
    }
    hora = parsedHora.data;
  }

  try {
    return NextResponse.json(await getIca(parsed.data, hora));
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
