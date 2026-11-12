import type { Metadata } from "next";
import { verifySession } from "@/lib/auth-session";
import type { Catalogo } from "@/lib/revision/models";
import { fetchCatalogo } from "@/lib/revision/repository";
import ValidacionPanel from "./components/validacion-panel";

export const metadata: Metadata = {
  title: "BA Aire - Validación",
  description: "Revisión manual de los datos: invalidar y reincorporar minutos",
};

export const dynamic = "force-dynamic";

export default async function ValidacionPage() {
  const { data } = await verifySession();

  // Estaciones y parámetros salen de dim. Si airedb no responde, la página se
  // muestra igual con el error: el listado lo va a avisar también.
  let catalogo: Catalogo | null = null;
  try {
    catalogo = await fetchCatalogo();
  } catch (error) {
    console.error("Error leyendo el catálogo de airedb:", error);
  }

  // El botón de alta se muestra según el rol de la cookie; el servidor vuelve a
  // verificar contra la base en cada escritura (lib/revision/service.ts).
  return (
    <ValidacionPanel catalogo={catalogo} puedeEditar={data.role === "EDITOR"} />
  );
}
