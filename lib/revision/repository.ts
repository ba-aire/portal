import { queryAiredb, transaccionDeEscritura } from "@/db/airedb";
import {
  type Catalogo,
  LIMITE_LISTADO,
  type ListarFiltros,
  type RegistrarPedido,
  type Revision,
  type VistaPrevia,
  type VistaPreviaPedido,
} from "./models";

// El schema `revision` de airedb (V18 en ba-aire/data). El portal LEE la tabla
// y las vistas con SELECT, y ESCRIBE solo llamando a revision.registrar() y
// revision.anular(): no tiene INSERT sobre nada. Todo valor del request viaja
// como $n.

// ---- Listado ------------------------------------------------------------------

// Una fila por invalidación o reincorporación, con su anulación al lado si la
// tiene. Las anulaciones no se listan sueltas: son un atributo de lo que anulan.
const LISTADO = `
  SELECT r.revision_id::int AS revision_id, r.accion,
         s.station_code, s.station_name,
         r.parameter_code, r.measurement,
         lower(r.periodo) AS desde, upper(r.periodo) AS hasta,
         r.motivo, r.registrado_por, r.registrado_en,
         a.revision_id::int AS anulacion_id, a.motivo AS anulacion_motivo,
         a.registrado_por AS anulacion_por, a.registrado_en AS anulacion_en
  FROM revision.revision r
  JOIN dim.stations s ON s.station_id = r.station_id
  LEFT JOIN revision.revision a ON a.anula_a = r.revision_id
  WHERE r.accion <> 'anular'
    AND ($1::text IS NULL OR s.station_code = $1)
    AND ($2::boolean = false OR a.revision_id IS NULL)
    AND ($3::timestamptz IS NULL OR upper(r.periodo) > $3)
    AND ($4::timestamptz IS NULL OR lower(r.periodo) < $4)
  ORDER BY r.registrado_en DESC
  LIMIT ${LIMITE_LISTADO}`;

type FilaListado = {
  revision_id: number;
  accion: Revision["accion"];
  station_code: string;
  station_name: string;
  parameter_code: string | null;
  measurement: string | null;
  desde: Date;
  hasta: Date;
  motivo: string;
  registrado_por: string;
  registrado_en: Date;
  anulacion_id: number | null;
  anulacion_motivo: string | null;
  anulacion_por: string | null;
  anulacion_en: Date | null;
};

export async function listarRevisiones(f: ListarFiltros): Promise<Revision[]> {
  const filas = await queryAiredb<FilaListado>(LISTADO, [
    f.station_code ?? null,
    f.estado === "vigentes",
    f.desde ?? null,
    f.hasta ?? null,
  ]);
  return filas.map((r) => ({
    revision_id: r.revision_id,
    accion: r.accion,
    station_code: r.station_code,
    station_name: r.station_name,
    parameter_code: r.parameter_code,
    measurement: r.measurement,
    desde: r.desde.toISOString(),
    hasta: r.hasta.toISOString(),
    motivo: r.motivo,
    registrado_por: r.registrado_por,
    registrado_en: r.registrado_en.toISOString(),
    anulacion:
      r.anulacion_id === null
        ? null
        : {
            revision_id: r.anulacion_id,
            motivo: r.anulacion_motivo ?? "",
            registrado_por: r.anulacion_por ?? "",
            registrado_en: r.anulacion_en?.toISOString() ?? "",
          },
  }));
}

// ---- Catálogo -----------------------------------------------------------------
// Estaciones y parámetros salen de dim y no de una lista en el código: si data
// suma un parámetro, el formulario lo ofrece sin tocar el portal.

export async function fetchCatalogo(): Promise<Catalogo> {
  const [estaciones, parametros] = await Promise.all([
    queryAiredb<Catalogo["estaciones"][number]>(
      "SELECT station_code, station_name FROM dim.stations ORDER BY station_name",
    ),
    queryAiredb<Catalogo["parametros"][number]>(
      `SELECT parameter_code, display_name, measurement
       FROM dim.parameters ORDER BY measurement, parameter_code`,
    ),
  ]);
  return { estaciones, parametros };
}

// ---- Vista previa ---------------------------------------------------------------
// Lo que hay HOY en el período, para que quien registra vea qué va a tocar
// antes de confirmar.
//
// El período está en la hora PUBLICADA (V18): para un equipo que publica la
// hora anterior (el BAM, dim.models.publica_hora_anterior) los minutos de la
// hora publicada H están en la hora de reloj H+1. Es el mismo corrimiento con
// que la horaria busca la revisión de cada minuto: por eso se lee una hora de
// más y se filtra por el instante publicado.

// $1 estación, $2 parámetro, $3 equipo (uno de los dos es NULL), $4 desde, $5 hasta.
const SERIE = `
  SELECT parameter_code, display_name
  FROM dim.parameters
  WHERE parameter_code = $2::text OR measurement = $3::text`;

// El status de cada minuto, con 'invalidado' para los ok o con alarma que ya
// saco una revision vigente: lo mismo que muestra /datos (lib/datos/repository).
const MINUTOS_POR_STATUS = `
  WITH p AS (${SERIE}),
  m AS (
    SELECT m.station_id, m.parameter_code, m.status, dp.measurement,
           m.ts_minute - CASE WHEN mo.publica_hora_anterior THEN INTERVAL '1 hour'
                              ELSE INTERVAL '0' END AS publicado
    FROM silver.minute_reading m
    JOIN p ON p.parameter_code = m.parameter_code
    JOIN dim.parameters dp ON dp.parameter_code = m.parameter_code
    JOIN dim.stations s ON s.station_id = m.station_id
    LEFT JOIN dim.instruments i ON i.instrument_id = m.instrument_id
    LEFT JOIN dim.models mo ON mo.model_id = i.model_id
    WHERE s.station_code = $1
      AND m.ts_minute >= $4::timestamptz
      AND m.ts_minute <  $5::timestamptz + INTERVAL '1 hour'
  )
  SELECT m.parameter_code,
         CASE WHEN m.status IN ('ok', 'alarm') AND EXISTS (
                SELECT 1 FROM revision.v_vigente v
                WHERE v.accion = 'invalidar'
                  AND v.station_id = m.station_id
                  AND (v.parameter_code = m.parameter_code OR v.measurement = m.measurement)
                  AND v.periodo @> m.publicado)
              THEN 'invalidado' ELSE m.status END AS status,
         count(*)::int AS minutos
  FROM m
  WHERE m.publicado >= $4::timestamptz AND m.publicado < $5::timestamptz
  GROUP BY 1, 2`;

// Las horas de gold que tocan el período (la primera puede empezar antes).
const HORAS_GOLD = `
  WITH p AS (${SERIE})
  SELECT g.parameter_code, count(*)::int AS horas,
         count(*) FILTER (WHERE g.is_valid)::int AS horas_validas
  FROM gold.v_hourly g
  JOIN p ON p.parameter_code = g.parameter_code
  JOIN dim.stations s ON s.station_id = g.station_id
  WHERE s.station_code = $1
    AND g.ts_hour >= date_trunc('hour', $4::timestamptz)
    AND g.ts_hour <  $5::timestamptz
  GROUP BY 1`;

// Revisiones vigentes de la estación que se superponen con el período y tocan
// algún parámetro de la serie: no es un error (la invalidación gana), pero
// conviene verlo antes de sumar otra.
const SUPERPUESTAS = `
  WITH p AS (${SERIE})
  SELECT v.revision_id::int AS revision_id, v.accion, v.parameter_code, v.measurement,
         lower(v.periodo) AS desde, upper(v.periodo) AS hasta
  FROM revision.v_vigente v
  JOIN dim.stations s ON s.station_id = v.station_id
  WHERE s.station_code = $1
    AND v.periodo && tstzrange($4::timestamptz, $5::timestamptz, '[)')
    AND EXISTS (
      SELECT 1 FROM p JOIN dim.parameters dp USING (parameter_code)
      WHERE p.parameter_code = v.parameter_code OR dp.measurement = v.measurement)
  ORDER BY lower(v.periodo)`;

export async function fetchVistaPrevia(
  pedido: VistaPreviaPedido,
): Promise<VistaPrevia> {
  const params = [
    pedido.station_code,
    pedido.parameter_code ?? null,
    pedido.measurement ?? null,
    pedido.desde,
    pedido.hasta,
  ];
  const [serie, minutos, horas, superpuestas] = await Promise.all([
    // Solo usa la serie: con los cinco parámetros, Postgres no sabe de qué
    // tipo son los que no aparecen.
    queryAiredb<{ parameter_code: string; display_name: string }>(
      `SELECT parameter_code, display_name FROM dim.parameters
       WHERE parameter_code = $1::text OR measurement = $2::text
       ORDER BY parameter_code`,
      [params[1], params[2]],
    ),
    queryAiredb<{ parameter_code: string; status: string; minutos: number }>(
      MINUTOS_POR_STATUS,
      params,
    ),
    queryAiredb<{
      parameter_code: string;
      horas: number;
      horas_validas: number;
    }>(HORAS_GOLD, params),
    queryAiredb<{
      revision_id: number;
      accion: VistaPrevia["superpuestas"][number]["accion"];
      parameter_code: string | null;
      measurement: string | null;
      desde: Date;
      hasta: Date;
    }>(SUPERPUESTAS, params),
  ]);

  return {
    parametros: serie.map((p) => {
      const h = horas.find((x) => x.parameter_code === p.parameter_code);
      return {
        parameter_code: p.parameter_code,
        display_name: p.display_name,
        minutos: Object.fromEntries(
          minutos
            .filter((m) => m.parameter_code === p.parameter_code)
            .map((m) => [m.status, m.minutos]),
        ),
        horas: h?.horas ?? 0,
        horas_validas: h?.horas_validas ?? 0,
      };
    }),
    superpuestas: superpuestas.map((s) => ({
      ...s,
      desde: s.desde.toISOString(),
      hasta: s.hasta.toISOString(),
    })),
  };
}

// ---- Escritura ----------------------------------------------------------------

export async function registrarRevision(
  pedido: RegistrarPedido,
  usuario: string,
): Promise<number> {
  return transaccionDeEscritura(async (consulta) => {
    const [fila] = await consulta<{ revision_id: string }>(
      "SELECT revision.registrar($1, $2, $3, $4, $5, $6, $7, $8) AS revision_id",
      [
        pedido.accion,
        pedido.station_code,
        pedido.parameter_code ?? null,
        pedido.measurement ?? null,
        pedido.desde,
        pedido.hasta,
        pedido.motivo,
        usuario,
      ],
    );
    // bigint llega como string desde pg.
    return Number(fila.revision_id);
  });
}

export async function anularRevision(
  revisionId: number,
  motivo: string,
  usuario: string,
): Promise<number> {
  return transaccionDeEscritura(async (consulta) => {
    const [fila] = await consulta<{ revision_id: string }>(
      "SELECT revision.anular($1, $2, $3) AS revision_id",
      [revisionId, motivo, usuario],
    );
    return Number(fila.revision_id);
  });
}
