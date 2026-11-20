/**
 * @file Plantilla CLÁSICA del reporte mensual, en HTML: la planilla Excel,
 * página por página.
 * @description Mismo contenido y mismo orden que el PDF que se subía a
 * buenosaires.gob.ar:
 *   1. tabla diaria, estadísticos del mes y excedencias
 *   2-4. gráficos: promedio 24 h, los tres bloques de 8 h, máximos y mínimos de 1 h
 *   5. perfil horario (tabla y gráfico)
 * Se agregan dos notas que la planilla no tenía: qué es "<LD" y que el perfil
 * horario se rotula por hora de inicio.
 *
 * Las medidas, los grosores y los fondos se tomaron del PDF publicado de
 * septiembre de 2026 (ver geometria() y fondos.ts). Todo en pt.
 */

import type { CSSProperties } from "react";
import { ENCABEZADO_INSTITUCIONAL, NOTA_EPA, PLANTILLAS } from "../config";
import { SKYLINE, TEXTURA_RECUADRO } from "../fondos";
import {
  etiquetaHora,
  GRUPOS_PERFIL,
  menorQueLD,
  NOTA_PERFIL,
  nombreVentana,
  ORDEN_HORAS_PERFIL,
  textoLimite,
  unidadImpresa,
} from "../formato";
import type { LimiteGrafico, SerieGrafico } from "../graficos";
import type { Dia, Excedencia, ReporteMensual } from "../models";
import type { TablaArmada } from "../tabla";
import {
  type Encabezados,
  tablaDias,
  tablaEstadisticos,
  tablaPerfil,
} from "../tablas";
import { COLORES_PARAMETRO, type Vista, vista } from "../vista";
import { CSS_HOJAS, dataUri, Grafico, Hoja, Leyenda, pt, Tabla } from "./base";

const ANCHO = 535; // A4 (595 pt) menos 30 pt por lado
const MAGENTA = "#9b2d6b";
const AZUL_TITULO = "#1a2fd6";
const GRUESO = 1.4; // el contorno y los separadores gruesos de la planilla
const GRILLA = "#666666"; // las líneas guía, más marcadas que en la nueva
const ARIAL = "Arial, Helvetica, 'Liberation Sans', sans-serif";
const TIMES = "'Times New Roman', Times, 'Liberation Serif', serif";

const textura = dataUri(TEXTURA_RECUADRO, "jpeg");
const skyline = dataUri(SKYLINE, "jpeg");

// Las medidas de la planilla, tomadas del PDF publicado de septiembre de 2026:
// columnas de valores de 46 pt con un parámetro (CO, PM10) y de 24 pt con tres
// (NOx); la de los días, de 57 y 49 pt. La tabla queda centrada y más angosta
// que la página. La de estadísticos tiene el mismo ancho: su rótulo ocupa lo
// que en la de días ocupan los días y el promedio diario.
function geometria(v: Vista) {
  const P = v.params.length;
  const valor = P > 1 ? 24 : 46;
  const dia = P > 1 ? 49 : 57;
  const ancho = dia + 6 * P * valor;
  return {
    ancho,
    dia,
    rotuloEstadisticos: ancho - 5 * P * valor,
    fuente: P > 1 ? 6.8 : 7.8,
    // Alto de cada fila del encabezado de las tablas: con el mes y el
    // promedio de 24 h ocupando dos filas, "Promedio 24 Hs" entra en dos
    // renglones.
    altoEncabezado: P > 1 ? 12 : 14,
  };
}

// Los colores de la planilla: celeste en los rótulos, gris el mes, verde claro
// el promedio diario, rosa los bloques de 8 h, amarillo las horas, violeta el
// perfil.
const COLORES: Encabezados = {
  rotulo: "#ccffff",
  mes: "#c0c0c0",
  promedio24: "#ccffcc",
  promedio8: "#ff99cc",
  promedio1: "#ffff99",
  perfil: "#e6d6ef",
};

/** Una tabla con el contorno y los separadores gruesos de la planilla. */
function TablaPlanilla({ t, fuente }: { t: TablaArmada; fuente: number }) {
  return <Tabla t={t} fuente={fuente} bordeExterior={GRUESO} grueso={GRUESO} />;
}

// Los tamaños de la planilla (medidos en el PDF publicado): las líneas
// institucionales en 11,5, 10, 9, 7,5, 9,5 y 9,5 pt; el título de la red en
// 11,5 y el contaminante en 12,5, magenta.
const TAMANOS_ENCABEZADO = [11.5, 10, 9, 7.5, 9.5, 9.5];

function Encabezado({ v }: { v: Vista }) {
  const linea = (fontSize: number, extra: CSSProperties = {}) => ({
    fontSize: pt(fontSize),
    fontWeight: 700,
    margin: `0 0 ${pt(1.5)}`,
    lineHeight: 1.15,
    ...extra,
  });
  return (
    <header style={{ textAlign: "center", marginBottom: pt(10) }}>
      {ENCABEZADO_INSTITUCIONAL.map((l, i) => (
        <div key={l} style={linea(TAMANOS_ENCABEZADO[i] ?? 9)}>
          {l}
        </div>
      ))}
      <div style={linea(11.5, { marginTop: pt(6) })}>
        Monitoreo Atmosférico Automático - Red de Estaciones EPA (*)
      </div>
      <div style={linea(12.5, { color: MAGENTA })}>{v.cfg.titulo}</div>
      <div style={linea(10)}>{v.estacion.titulo}</div>
      <div style={linea(10)}>{v.mesTitulo}</div>
    </header>
  );
}

function NotasDeTabla({ v }: { v: Vista }) {
  const lds = v.params
    .map((p) => ({ p, ld: v.ld(p) }))
    .filter((x): x is { p: string; ld: number } => x.ld !== null);
  // Un analizador de NOx tiene un solo límite para NO, NO2 y NOx: si todos
  // coinciden, se nombra una vez, sin parámetro.
  const unSoloLimite = new Set(lds.map((x) => x.ld)).size === 1;
  return (
    <div
      style={{
        fontSize: pt(6.5),
        fontWeight: 700,
        marginTop: pt(3),
        display: "flex",
        flexDirection: "column",
        gap: pt(1.5),
      }}
    >
      {v.cfg.definicionUnidad && <div>{v.cfg.definicionUnidad}</div>}
      <div style={{ display: "flex" }}>
        <span style={{ width: pt(120) }}>DND: Dato no disponible</span>
        <span>SD: Sin Dato</span>
      </div>
      {lds.length > 0 && (
        <div>
          {`${menorQueLD(lds[0].ld)}: valor horario por debajo del límite de detección del analizador (${lds
            .map(
              (x) =>
                `${v.varios && !unSoloLimite ? `${v.nombre(x.p)} ` : ""}${menorQueLD(x.ld).slice(1)} ${unidadImpresa(v.ficha(x.p)?.unidad ?? "")}`,
            )
            .slice(0, unSoloLimite ? 1 : undefined)
            .join(", ")})`}
        </div>
      )}
      <div>{NOTA_EPA}</div>
    </div>
  );
}

function Excedencias({ v }: { v: Vista }) {
  const exc = v.excedencias();
  if (exc.length === 0) return null;
  const soloDias = exc.every((e) => e.window_code === "24h");
  const titulo = soloDias
    ? "Cantidad de días que excedieron la norma de Calidad de Aire (*1)"
    : "Cantidad de períodos que excedieron la norma de Calidad de Aire (*1)";
  const rotulo = (e: Excedencia) =>
    `${nombreVentana(e)}${v.varios ? ` ${v.nombre(e.parameter_code)}` : ""} (*1)`;
  const t: TablaArmada = {
    columnas: exc.map(() => ({ ancho: 100 })),
    filas: [
      {
        celdas: exc.map(rotulo),
        estilo: { fontWeight: 700 },
        estilosCelda: exc.map((e) => ({
          backgroundColor:
            e.window_code === "1h" ? COLORES.promedio1 : COLORES.promedio8,
        })),
      },
      { celdas: exc.map((e) => String(e.n_excedencias)) },
    ],
    gruesas: [],
    filasGruesas: [0],
  };
  return (
    <div style={{ marginTop: pt(10), breakInside: "avoid" }}>
      <div
        style={{
          fontSize: pt(8),
          fontWeight: 700,
          textDecoration: "underline",
          marginBottom: pt(3),
          textAlign: "center",
        }}
      >
        {titulo}
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Tabla
          t={t}
          fuente={8}
          bordeExterior={GRUESO}
          grueso={GRUESO}
          padding="1pt 2pt"
        />
      </div>
      <div style={{ fontSize: pt(7), marginTop: pt(4) }}>
        <div style={{ fontWeight: 700, textDecoration: "underline" }}>
          (*1)Las excedencias se evalúan de acuerdo a los siguientes Límites
          Admisibles:
        </div>
        {exc.map((e) => (
          <div key={`${e.parameter_code}${e.window_code}`}>
            {textoLimite(e, v.nombre(e.parameter_code), v.varios)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Gráficos ----------------------------------------------------------------------

function CajaGrafico({
  v,
  subtitulo,
  series,
  escala,
  paso,
  limite,
  etiquetasX,
  perfil = false,
}: {
  v: Vista;
  subtitulo: string;
  series: SerieGrafico[];
  escala: number;
  paso: number;
  limite?: LimiteGrafico;
  etiquetasX: string[];
  /**
   * El perfil horario de la planilla es distinto: recuadro blanco, área gris
   * lisa sin el skyline, título con serifa y el subtítulo arriba.
   */
  perfil?: boolean;
}) {
  const tituloY = v.varios
    ? `Concentración (${v.cfg.unidad})`
    : `Concentración de ${v.nombre(v.params[0])} (${v.cfg.unidad})`;
  const linea = (fontSize: number): CSSProperties => ({
    fontSize: pt(fontSize),
    lineHeight: 1.15,
  });
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: pt(ANCHO),
        padding: pt(8),
        marginBottom: pt(14),
        border: `${pt(0.9)} solid #808080`,
        backgroundColor: perfil ? "#ffffff" : "#dce8f6",
        // La textura celeste de la planilla, en franjas, de arriba abajo.
        backgroundImage: perfil ? undefined : `url(${textura})`,
        backgroundSize: "100% auto",
        backgroundRepeat: "repeat-y",
        breakInside: "avoid",
      }}
    >
      <div
        style={{ textAlign: "center", fontWeight: 700, marginBottom: pt(4) }}
      >
        <div style={linea(11)}>Gobierno de la Ciudad de Buenos Aires</div>
        <div style={linea(9)}>Agencia de Protección Ambiental</div>
        <div style={linea(8.5)}>Dirección General de Control Ambiental</div>
        <div style={linea(8)}>
          Gerencia Operativa de Determinaciones Ambientales y Laboratorio
        </div>
        <div
          style={{
            ...linea(perfil ? 11 : 10.5),
            color: AZUL_TITULO,
            textDecoration: "underline",
            ...(perfil ? { fontFamily: TIMES, fontWeight: 400 } : {}),
          }}
        >
          {`Monitoreo Atmosférico - ${v.cfg.nombre}`}
        </div>
        {perfil && (
          <div style={{ ...linea(10.5), fontFamily: TIMES, fontWeight: 400 }}>
            {subtitulo}
          </div>
        )}
      </div>
      <Grafico
        ancho={ANCHO - 18}
        alto={200}
        etiquetasX={etiquetasX}
        series={series}
        escala={escala}
        paso={paso}
        limite={limite}
        imagenFondo={perfil ? undefined : skyline}
        fondo="#c0c0c0"
        grilla={GRILLA}
        grosorGrilla={0.5}
        tituloY={perfil ? tituloY.toUpperCase() : tituloY}
        tamanoRotulos={6.5}
        puntos={!perfil}
        // Todos dejan margen antes del primer valor y después del último, como
        // la planilla.
        categorias
        familia={ARIAL}
      />
      <div
        style={{ display: "flex", alignItems: "flex-end", marginTop: pt(4) }}
      >
        {perfil ? (
          <>
            <div style={{ width: pt(160) }} />
            <div style={{ flex: 1, textAlign: "center", fontWeight: 700 }}>
              <div style={linea(9)}>{v.mesTitulo}</div>
              <div style={{ ...linea(8.5), color: MAGENTA }}>
                {v.estacion.rotulo}
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                ...linea(8.5),
                fontWeight: 700,
                color: MAGENTA,
                width: pt(140),
              }}
            >
              {v.estacion.rotulo}
            </div>
            <div
              style={{
                ...linea(9),
                flex: 1,
                textAlign: "center",
                fontWeight: 700,
              }}
            >
              <div>{v.mesTitulo}</div>
              <div>{subtitulo}</div>
            </div>
          </>
        )}
        <div style={{ width: pt(160) }}>
          <Leyenda
            tamano={6.5}
            columnas={perfil ? 2 : 1}
            items={[
              ...series.map((s) => ({
                nombre: s.nombre,
                color: s.color,
                grosor: s.grosor,
                marcador: !perfil,
              })),
              ...(limite
                ? [
                    {
                      nombre: limite.etiqueta,
                      color: limite.color ?? "#e00000",
                      grosor: 2.5,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function limiteGrafico(
  v: Vista,
  ventana: "1h" | "8h" | "24h",
): LimiteGrafico | undefined {
  const e = v.limiteDe(ventana);
  if (!e) return undefined;
  return {
    valor: e.limite,
    etiqueta: `Valor límite admisible: ${textoLimite(e, v.nombre(e.parameter_code), v.varios).replace(/^[^:]+: /, "")}`,
  };
}

function seriesPorDia(v: Vista, campo: keyof Dia, sufijo = ""): SerieGrafico[] {
  return v.params.map((p, i) => ({
    nombre: `${v.nombre(p)}${sufijo}`,
    color: v.varios ? COLORES_PARAMETRO[i] : AZUL_TITULO,
    // Como la planilla: líneas de 2 pt (el marcador escala con la línea).
    grosor: 2,
    valores: v.dias(p).map((d) => (d[campo] as number | null) ?? null),
  }));
}

const paginaConEncabezado: CSSProperties = {
  padding: `${pt(22)} ${pt(30)} ${pt(30)}`,
};
const paginaDeGraficos: CSSProperties = { padding: `${pt(30)} ${pt(30)}` };

export function ReporteClasico({ reporte }: { reporte: ReporteMensual }) {
  const v = vista(reporte);
  const g = geometria(v);
  const pl = PLANTILLAS.clasico;
  const pie = `Versión clásica v${pl.version} · Generado el ${v.generado} desde SIRCA`;
  const diasX = v.dias(v.params[0]).map((d) => String(d.dia));
  const bloques: [keyof Dia, string, string][] = [
    ["bloque_0_8", "de 0 a 8 hs", "#5ea500"],
    ["bloque_8_16", "de 8 a 16 hs", "#e6008a"],
    ["bloque_16_24", "de 16 a 24 hs", "#ff8c00"],
  ];

  const maxMin: SerieGrafico[] = v.varios
    ? seriesPorDia(v, "max_1h", " (Máx. 1 hora)")
    : [
        {
          ...seriesPorDia(v, "max_1h")[0],
          nombre: "Máximo en 1 hora",
          color: AZUL_TITULO,
        },
        {
          ...seriesPorDia(v, "min_1h")[0],
          nombre: "Mínimo en 1 hora",
          color: "#ff00cc",
        },
      ];

  const perfilSeries: SerieGrafico[] = (
    ["mensual", "sabado", "domingo_feriado", "lunes_a_viernes"] as const
  ).map((grupo, i) => ({
    nombre: `${GRUPOS_PERFIL[grupo]}${v.varios ? ` ${v.nombre(v.cfg.parametroPerfil)}` : ""}`,
    color: ["#000080", "#ffd700", "#2e8b57", "#ff00ff"][i],
    grosor: 2,
    valores: ORDEN_HORAS_PERFIL.map(
      (h) => v.perfil(v.cfg.parametroPerfil, grupo, h)?.valor ?? null,
    ),
  }));

  const graficos = [
    <CajaGrafico
      key="diario"
      v={v}
      subtitulo={`Concentración diaria${v.varios ? "" : ` de ${v.nombre(v.params[0])}`} - Promedio 24 Hs`}
      series={seriesPorDia(v, "prom_24h").map((s) =>
        // Con un parámetro la planilla rotula la serie por lo que es, no por
        // el contaminante (que ya está en el título).
        v.varios ? s : { ...s, nombre: "Promedio 24 Hs" },
      )}
      escala={v.cfg.escalas.diario}
      paso={v.cfg.pasos.diario}
      limite={limiteGrafico(v, "24h")}
      etiquetasX={diasX}
    />,
    ...bloques.map(([campo, rotulo, color]) => (
      <CajaGrafico
        key={campo}
        v={v}
        subtitulo={`Concentración promedios de 8 hs - ${rotulo}`}
        series={seriesPorDia(v, campo).map((s) =>
          v.varios ? s : { ...s, color, nombre: `${s.nombre} ${rotulo}` },
        )}
        escala={v.cfg.escalas.bloques}
        paso={v.cfg.pasos.bloques}
        limite={limiteGrafico(v, "8h")}
        etiquetasX={diasX}
      />
    )),
    <CajaGrafico
      key="horario"
      v={v}
      subtitulo={
        v.varios
          ? "Concentración máxima de promedios de 1 hora"
          : "Máximos y mínimos en intervalos de 1 hora"
      }
      series={maxMin}
      escala={v.cfg.escalas.horario}
      paso={v.cfg.pasos.horario}
      limite={limiteGrafico(v, "1h")}
      etiquetasX={diasX}
    />,
  ];
  // Dos gráficos por hoja, como la planilla: 2, 2 y 1.
  const hojasDeGraficos = [
    graficos.slice(0, 2),
    graficos.slice(2, 4),
    graficos.slice(4),
  ];
  const total = 2 + hojasDeGraficos.length;
  const perfil = tablaPerfil(v, ANCHO, COLORES, g.altoEncabezado);

  return (
    <div style={{ fontFamily: ARIAL }}>
      <style>{CSS_HOJAS}</style>

      <Hoja pie={pie} numero={1} total={total} estilo={paginaConEncabezado}>
        <Encabezado v={v} />
        {/* Todo el bloque sigue el ancho de la tabla: las notas y las
            excedencias arrancan en su borde izquierdo, como en la planilla. */}
        <div style={{ width: pt(g.ancho), margin: "0 auto" }}>
          <TablaPlanilla
            t={tablaDias(v, g.ancho, COLORES, g.dia, g.altoEncabezado)}
            fuente={g.fuente}
          />
          <div
            style={{
              fontSize: pt(7.5),
              fontWeight: 700,
              textAlign: "center",
              borderLeft: `${pt(GRUESO)} solid #000`,
              borderRight: `${pt(GRUESO)} solid #000`,
              backgroundColor: "#e0e0e0",
              padding: pt(1),
            }}
          >
            PARÁMETROS ESTADÍSTICOS
          </div>
          <TablaPlanilla
            t={tablaEstadisticos(
              v,
              g.ancho,
              COLORES,
              g.rotuloEstadisticos,
              g.altoEncabezado,
            )}
            fuente={g.fuente}
          />
          <NotasDeTabla v={v} />
          <Excedencias v={v} />
        </div>
      </Hoja>

      {hojasDeGraficos.map((grupo, i) => (
        <Hoja
          // biome-ignore lint/suspicious/noArrayIndexKey: hojas fijas
          key={i}
          pie={pie}
          numero={2 + i}
          total={total}
          estilo={paginaDeGraficos}
        >
          {grupo}
        </Hoja>
      ))}

      <Hoja pie={pie} numero={total} total={total} estilo={paginaConEncabezado}>
        <Encabezado v={v} />
        {/* Como la planilla: la barra va sobre las columnas de valores (no
            sobre "HORARIO") y con el contorno grueso de la tabla. */}
        <div
          style={{
            marginLeft: pt(perfil.columnas[0].ancho),
            fontSize: pt(7.5),
            fontWeight: 700,
            textAlign: "center",
            color: "#ffffff",
            backgroundColor: "#6a1b7a",
            padding: pt(2),
            border: `${pt(GRUESO)} solid #000`,
            borderBottom: "none",
          }}
        >
          PROMEDIOS HORARIOS
        </div>
        <TablaPlanilla t={perfil} fuente={v.varios ? 5.5 : 6.5} />
        <div
          style={{
            fontSize: pt(6.5),
            marginTop: pt(3),
            marginBottom: pt(8),
          }}
        >
          {NOTA_PERFIL}
        </div>
        <CajaGrafico
          v={v}
          perfil
          subtitulo="Perfil Horario de Contaminación"
          series={perfilSeries}
          escala={v.cfg.escalas.perfil}
          paso={v.cfg.pasos.perfil}
          etiquetasX={ORDEN_HORAS_PERFIL.map((h) =>
            etiquetaHora(h).replace(" a ", " a\n"),
          )}
        />
      </Hoja>
    </div>
  );
}
