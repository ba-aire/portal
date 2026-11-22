import { queryAiredb, transaccionDeEscritura } from "@/db/airedb";
import {
  type Carga,
  type CargarPedido,
  type CargaSolapada,
  LIMITE_LISTADO,
  type ListarFiltros,
  type VistaPrevia,
  type VistaPreviaPedido,
} from "./models";

// El schema `carga` de airedb (V19 en ba-aire/data). El portal LEE con SELECT y
// ESCRIBE solo por carga.cargar() y carga.anular(): no tiene INSERT sobre nada.
// Las horas viajan como UN parámetro jsonb, nunca interpoladas.

// ---- Listado ------------------------------------------------------------------

const LISTADO = `
  SELECT r.carga_id::int AS carga_id, r.origen, s.station_code, s.station_name,
         r.archivo, r.motivo, r.registrado_por, r.registrado_en,
         r.n_horas, r.desde, r.hasta, r.parametros,
         r.anulacion_id::int AS anulacion_id, r.anulacion_motivo,
         r.anulacion_por, r.anulacion_en
  FROM carga.v_resumen r
  JOIN dim.stations s ON s.station_id = r.station_id
  WHERE ($1::text IS NULL OR s.station_code = $1)
    AND ($2::boolean = false OR r.anulacion_id IS NULL)
  ORDER BY r.registrado_en DESC, r.carga_id DESC
  LIMIT ${LIMITE_LISTADO}`;

type FilaListado = Omit<
  Carga,
  "registrado_en" | "desde" | "hasta" | "anulacion"
> & {
  registrado_en: Date;
  desde: Date | null;
  hasta: Date | null;
  anulacion_id: number | null;
  anulacion_motivo: string | null;
  anulacion_por: string | null;
  anulacion_en: Date | null;
};

export async function listarCargas(f: ListarFiltros): Promise<Carga[]> {
  const filas = await queryAiredb<FilaListado>(LISTADO, [
    f.station_code ?? null,
    f.estado === "vigentes",
  ]);
  return filas.map((r) => ({
    carga_id: r.carga_id,
    origen: r.origen,
    station_code: r.station_code,
    station_name: r.station_name,
    archivo: r.archivo,
    motivo: r.motivo,
    registrado_por: r.registrado_por,
    registrado_en: r.registrado_en.toISOString(),
    n_horas: r.n_horas ?? 0,
    desde: r.desde?.toISOString() ?? null,
    hasta: r.hasta?.toISOString() ?? null,
    parametros: r.parametros ?? [],
    anulacion:
      r.anulacion_id === null
        ? null
        : {
            carga_id: r.anulacion_id,
            motivo: r.anulacion_motivo ?? "",
            registrado_por: r.anulacion_por ?? "",
            registrado_en: r.anulacion_en?.toISOString() ?? "",
          },
  }));
}

// ---- Vista previa ---------------------------------------------------------------
// Qué trae el lote y qué pisa, antes de confirmar. $1 estación, $2 las horas.

const VISTA_PREVIA = `
  WITH lote AS (
    SELECT x.parameter_code, x.ts_hour, x.value
    FROM jsonb_to_recordset($2::jsonb)
         AS x(parameter_code text, ts_hour timestamptz, value numeric)
  ), est AS (
    SELECT station_id FROM dim.stations WHERE station_code = $1
  )
  SELECT l.parameter_code,
         coalesce(p.display_name, l.parameter_code) AS display_name,
         p.display_unit AS unit,
         count(*)::int AS horas,
         min(l.ts_hour) AS desde,
         max(l.ts_hour) + INTERVAL '1 hour' AS hasta,
         min(l.value)::float8 AS minimo,
         max(l.value)::float8 AS maximo,
         count(*) FILTER (WHERE g.is_valid)::int AS reemplaza_validas,
         count(v.ts_hour)::int AS ya_cargadas
  FROM lote l
  CROSS JOIN est
  LEFT JOIN dim.parameters p ON p.parameter_code = l.parameter_code
  LEFT JOIN gold.v_hourly g
         ON g.station_id = est.station_id
        AND g.parameter_code = l.parameter_code
        AND g.ts_hour = l.ts_hour
  LEFT JOIN carga.v_vigente v
         ON v.station_id = est.station_id
        AND v.parameter_code = l.parameter_code
        AND v.ts_hour = l.ts_hour
  GROUP BY l.parameter_code, p.display_name, p.display_unit
  ORDER BY l.parameter_code`;

// Las cargas vigentes que el lote pisa: las que hoy GANAN en alguna hora del
// lote (carga.v_vigente), para la estación del archivo. Se cruza por parámetro y
// hora, no por rango: un parámetro que el archivo no trae no se toca. Una hora
// que otra carga ya había ganado no cuenta para la vieja, que ahí no valía.
const SOLAPES = `
  WITH lote AS (
    SELECT x.parameter_code, x.ts_hour
    FROM jsonb_to_recordset($2::jsonb)
         AS x(parameter_code text, ts_hour timestamptz)
  ), est AS (
    SELECT station_id FROM dim.stations WHERE station_code = $1
  )
  SELECT c.carga_id::int AS carga_id, c.archivo, c.motivo,
         c.registrado_por, c.registrado_en,
         count(*)::int AS horas,
         min(v.ts_hour) AS desde,
         max(v.ts_hour) + INTERVAL '1 hour' AS hasta,
         array_agg(DISTINCT v.parameter_code ORDER BY v.parameter_code) AS parametros
  FROM lote l
  CROSS JOIN est
  JOIN carga.v_vigente v
    ON v.station_id = est.station_id
   AND v.parameter_code = l.parameter_code
   AND v.ts_hour = l.ts_hour
  JOIN carga.carga c ON c.carga_id = v.carga_id
  GROUP BY c.carga_id, c.archivo, c.motivo, c.registrado_por, c.registrado_en
  ORDER BY c.carga_id DESC`;

type FilaVistaPrevia = Omit<
  VistaPrevia["parametros"][number],
  "desde" | "hasta"
> & {
  desde: Date;
  hasta: Date;
};

type FilaSolape = Omit<CargaSolapada, "registrado_en" | "desde" | "hasta"> & {
  registrado_en: Date;
  desde: Date;
  hasta: Date;
};

export async function fetchVistaPrevia(
  pedido: VistaPreviaPedido,
): Promise<VistaPrevia> {
  const params = [pedido.station_code, JSON.stringify(pedido.horas)];
  const [filas, solapes] = await Promise.all([
    queryAiredb<FilaVistaPrevia>(VISTA_PREVIA, params),
    queryAiredb<FilaSolape>(SOLAPES, params),
  ]);
  return {
    parametros: filas.map((f) => ({
      ...f,
      desde: f.desde.toISOString(),
      hasta: f.hasta.toISOString(),
    })),
    solapes: solapes.map((s) => ({
      ...s,
      registrado_en: s.registrado_en.toISOString(),
      desde: s.desde.toISOString(),
      hasta: s.hasta.toISOString(),
    })),
  };
}

// ---- Escritura ----------------------------------------------------------------

export async function registrarCarga(
  pedido: CargarPedido,
  usuario: string,
): Promise<number> {
  return transaccionDeEscritura(async (consulta) => {
    const [fila] = await consulta<{ carga_id: string }>(
      // El origen es fijo: por acá solo entra lo que sube una persona.
      "SELECT carga.cargar('portal', $1, $2, $3, $4, $5::jsonb) AS carga_id",
      [
        pedido.station_code,
        pedido.archivo ?? null,
        pedido.motivo,
        usuario,
        JSON.stringify(pedido.horas),
      ],
    );
    return Number(fila.carga_id);
  });
}

export async function anularCarga(
  cargaId: number,
  motivo: string,
  usuario: string,
): Promise<number> {
  return transaccionDeEscritura(async (consulta) => {
    const [fila] = await consulta<{ carga_id: string }>(
      "SELECT carga.anular($1, $2, $3) AS carga_id",
      [cargaId, motivo, usuario],
    );
    return Number(fila.carga_id);
  });
}
