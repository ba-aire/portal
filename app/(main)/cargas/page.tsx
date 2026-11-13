import type { Metadata } from "next";
import { verifySession } from "@/lib/auth-session";
import type { Catalogo } from "@/lib/revision/models";
import { fetchCatalogo } from "@/lib/revision/repository";
import { ROLES_QUE_REVISAN } from "@/lib/revision/service";
import CargasPanel from "./components/cargas-panel";

export const metadata: Metadata = {
  title: "BA Aire - Carga de datos",
  description: "Carga manual de promedios horarios ya validados",
};

export const dynamic = "force-dynamic";

export default async function CargasPage() {
  const { data } = await verifySession();

  // Estaciones y parámetros salen de dim: los encabezados del archivo se
  // comparan contra dim.parameters, no contra una lista en el código.
  let catalogo: Catalogo | null = null;
  try {
    catalogo = await fetchCatalogo();
  } catch (error) {
    console.error("Error leyendo el catálogo de airedb:", error);
  }

  // El botón se muestra según el rol de la cookie; el servidor vuelve a
  // verificar contra la base en cada escritura.
  return (
    <CargasPanel
      catalogo={catalogo}
      puedeEditar={ROLES_QUE_REVISAN.includes(data.role)}
    />
  );
}
