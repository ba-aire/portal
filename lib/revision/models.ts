import { z } from "zod";

// Revisión manual de los datos (schema `revision` de airedb, V18 en
// ba-aire/data). El portal registra decisiones; las aplica la horaria de data
// en su próxima corrida (cada 5 min): silver.hourly_reading y gold se
// recalculan con los minutos invalidados afuera.
//
// Lo que se valida acá es la FORMA del pedido, para cortar temprano y con un
// mensaje claro. La base vuelve a validar todo (revision.registrar y las CHECK
// de la tabla): este archivo no es la última palabra, es la primera.

export const ACCIONES = ["invalidar", "reincorporar"] as const;
export const AccionEnum = z.enum(ACCIONES);
export type Accion = z.infer<typeof AccionEnum>;

export const ETIQUETA_ACCION: Record<Accion | "anular", string> = {
  invalidar: "Invalidar",
  reincorporar: "Reincorporar alarmas",
  anular: "Anular",
};

// Los códigos de dim: mismas reglas que sus CHECK. Que existan lo decide la base.
const codigo = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]+$/, "Código inválido");

/** Un instante en minutos enteros: lo exige la CHECK revision_periodo_ck. */
const minuto = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inválida")
  .transform((s) => new Date(s))
  .refine(
    (d) => d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0,
    "La fecha tiene que caer en un minuto entero",
  );

export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 1000;

// Un período más largo que esto es casi seguro un error de tipeo (un año de
// más). Si algún día hace falta, se registran dos revisiones.
export const MAX_DIAS_PERIODO = 366;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Estación, una serie (parámetro o equipo, uno solo) y período [desde, hasta). */
const SerieYPeriodo = z
  .object({
    station_code: codigo,
    parameter_code: codigo.nullish(),
    measurement: codigo.nullish(),
    desde: minuto,
    hasta: minuto,
  })
  .refine((v) => !v.parameter_code !== !v.measurement, {
    message: "Hay que elegir un parámetro o un equipo, uno solo",
    path: ["parameter_code"],
  })
  // Zod corre los refine del objeto aunque una fecha ya haya fallado (y siga
  // siendo el string): sin la guarda, getTime() revienta en vez de dar un 400.
  .superRefine((v, ctx) => {
    if (!(v.desde instanceof Date) || !(v.hasta instanceof Date)) return;
    if (v.desde >= v.hasta) {
      ctx.addIssue({
        code: "custom",
        message: "«Desde» tiene que ser anterior a «hasta»",
        path: ["hasta"],
      });
    } else if (
      v.hasta.getTime() - v.desde.getTime() >
      MAX_DIAS_PERIODO * DIA_MS
    ) {
      ctx.addIssue({
        code: "custom",
        message: `El período no puede pasar de ${MAX_DIAS_PERIODO} días`,
        path: ["hasta"],
      });
    }
  });

export const VistaPreviaSchema = SerieYPeriodo;
export type VistaPreviaPedido = z.infer<typeof VistaPreviaSchema>;

export const RegistrarSchema = SerieYPeriodo.and(
  z.object({
    accion: AccionEnum,
    motivo: z
      .string()
      .trim()
      .min(MOTIVO_MIN, `El motivo necesita al menos ${MOTIVO_MIN} caracteres`)
      .max(MOTIVO_MAX, `El motivo no puede pasar de ${MOTIVO_MAX} caracteres`),
  }),
);
export type RegistrarPedido = z.infer<typeof RegistrarSchema>;

export const AnularSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(MOTIVO_MIN, `El motivo necesita al menos ${MOTIVO_MIN} caracteres`)
    .max(MOTIVO_MAX, `El motivo no puede pasar de ${MOTIVO_MAX} caracteres`),
});

export const RevisionIdSchema = z.coerce.number().int().positive();

// El listado: filtros opcionales. `desde`/`hasta` traen las revisiones cuyo
// período se superpone con ese rango.
export const ListarSchema = z.object({
  station_code: codigo.optional(),
  estado: z.enum(["vigentes", "todas"]).default("vigentes"),
  desde: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inválida")
    .transform((s) => new Date(s))
    .optional(),
  hasta: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inválida")
    .transform((s) => new Date(s))
    .optional(),
});
export type ListarFiltros = z.infer<typeof ListarSchema>;

// Tope de filas del listado: son decisiones de una persona, no deberían ser
// miles; si lo son, se filtra.
export const LIMITE_LISTADO = 500;

// ---- Respuestas ---------------------------------------------------------------

export type Revision = {
  revision_id: number;
  accion: Accion;
  station_code: string;
  station_name: string;
  parameter_code: string | null;
  measurement: string | null;
  desde: string;
  hasta: string;
  motivo: string;
  registrado_por: string;
  registrado_en: string;
  /** Null si sigue vigente. */
  anulacion: {
    revision_id: number;
    motivo: string;
    registrado_por: string;
    registrado_en: string;
  } | null;
};

export type Catalogo = {
  estaciones: Array<{ station_code: string; station_name: string }>;
  parametros: Array<{
    parameter_code: string;
    display_name: string;
    measurement: string;
  }>;
};

/** Lo que cambiaría una revisión, por parámetro de la serie. */
export type VistaPreviaParametro = {
  parameter_code: string;
  display_name: string;
  /** Minutos del período por status de silver (ok, alarm, zero...). */
  minutos: Record<string, number>;
  /** Horas de gold que tocan el período, y cuántas son válidas hoy. */
  horas: number;
  horas_validas: number;
};

export type VistaPrevia = {
  parametros: VistaPreviaParametro[];
  /** Revisiones vigentes de la misma estación que se superponen con el período. */
  superpuestas: Array<{
    revision_id: number;
    accion: Accion;
    parameter_code: string | null;
    measurement: string | null;
    desde: string;
    hasta: string;
  }>;
};
