/**
 * @file Plantilla NUEVA del reporte mensual, en HTML: la dirección
 * "A · Institucional" elegida en el lienzo de diseño (2026-11-18).
 * @description Los mismos números que la clásica, ordenados para leerse:
 *   1. banda con el título; resumen del mes; excedencias con el máximo de cada
 *      ventana; concentración diaria; perfil horario por tipo de día (con un
 *      solo parámetro; con varios, el perfil abre la hoja 2)
 *   2. tabla diaria
 *   3. estadísticos y promedios horarios por tipo de día
 *   4. método y fuentes
 * Tipografía Source Sans 3 (public/fonts). Paleta de las series validada para
 * daltonismo e impresión: azul, naranja y verde agua.
 *
 * Los LÍMITES NO SE DIBUJAN cuando quedan muy por encima de los datos: con un
 * máximo de 1,7 ppm, una línea en 26 ppm aplasta la serie contra el piso. Se
 * dibuja solo si está cerca (hasta 1,5 veces el máximo de lo graficado); si
 * no, una nota dice que queda fuera de escala.
 */

import type { CSSProperties, ReactNode } from "react";
import { BASE_PATH } from "@/lib/base-path";
import { NOTA_EPA, PLANTILLAS } from "../config";
import {
  etapaDe,
  menorQueLD,
  NOTA_PERFIL,
  numero,
  ORDEN_HORAS_PERFIL,
  textoLimite,
  unidadImpresa,
} from "../formato";
import {
  type LimiteGrafico,
  maximoDelEje,
  type SerieGrafico,
} from "../graficos";
import { LOGO_BA_PRIMARIO, LOGO_PROPORCION } from "../logo";
import type { Excedencia, GrupoPerfil, ReporteMensual } from "../models";
import type { TablaArmada } from "../tabla";
import {
  type Encabezados,
  tablaDias,
  tablaEstadisticos,
  tablaPerfil,
} from "../tablas";
import { type Vista, vista } from "../vista";
import { CSS_HOJAS, dataUri, Grafico, Hoja, pt, Tabla } from "./base";

const MARGEN = 36; // 48 px del diseño, en puntos
const ANCHO = 595 - 2 * MARGEN;
// Los colores del portal (app/globals.css; skill sirca-design): azul oscuro de
// marca, turquesa de acento y el amarillo del logo. El turquesa va solo sobre el
// azul (sobre blanco no tiene contraste).
const ACENTO = "#143144"; // --primary, hsl(204 55% 17%)
const TURQUESA = "#8de1d6"; // --secondary, hsl(172 58% 72%)
const AMARILLO = "#ffcb00"; // --accent, el fondo del logo en la barra lateral
const TINTA = "#1c2430";
const GRIS = "#4a5462";
const BORDE = "#c5ccd6";
const GRILLA = "#e3e7ec";
// Paleta categórica (azul, naranja, verde agua), en orden fijo.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"];
const FUENTE = "'Source Sans 3', 'Source Sans Pro', Arial, sans-serif";

const COLORES: Encabezados = {
  rotulo: "#eef1f5",
  promedio24: "#e3ebf4",
  promedio8: "#eef1f5",
  promedio1: "#f5f7fa",
  perfil: "#eef1f5",
};

const logo = dataUri(LOGO_BA_PRIMARIO, "png");
/** Lado del cuadrado amarillo del logo, en pt. */
const LADO_LOGO = 26;

// La tipografía sale de public/ (con el basePath del portal): la carga el
// navegador, y Chromium en Gotenberg igual.
const CSS_FUENTE = [400, 600, 700]
  .map(
    (peso) => `@font-face {
  font-family: 'Source Sans 3';
  font-weight: ${peso};
  font-style: normal;
  src: url('${BASE_PATH}/fonts/source-sans-3/source-sans-3-latin-${peso}-normal.woff') format('woff');
}`,
  )
  .join("\n");

/**
 * La banda del título, opción "C · Banda sobria" (2026-11-21): el azul de marca
 * (skill sirca-design), todo alineado a la izquierda y sin adornos. Arriba, el
 * mismo bloque que la barra lateral del portal (logo sobre el cuadrado amarillo
 * y "APrA / Red de Calidad del Aire"); abajo el contaminante y, debajo, la
 * estación, el tipo de reporte y el mes ("Estación La Boca · Reporte Mensual ·
 * Septiembre 2026"). Una sola línea turquesa la separa del contenido. El
 * amarillo queda solo en el logo.
 */
function Banda({ v }: { v: Vista }) {
  const mes = `${v.mesTitulo.charAt(0)}${v.mesTitulo.slice(1).toLowerCase()}`;
  const siglas = v.params.map((p) => v.nombre(p)).join(", ");
  // "Material Particulado (PM10)" ya trae la sigla: no se repite.
  const titulo = v.cfg.nombre.includes("(")
    ? v.cfg.nombre
    : `${v.cfg.nombre} (${siglas})`;
  // Blanco atenuado para lo secundario: sobre el azul sigue teniendo contraste.
  const blancoSuave = "rgba(255, 255, 255, 0.82)";
  return (
    <header>
      <div
        style={{
          backgroundColor: ACENTO,
          color: "#ffffff",
          padding: `${pt(16)} ${pt(MARGEN)}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: pt(7) }}>
          {/* Un cuadrado amarillo con el logo al 75 % del ancho, centrado:
              las proporciones del avatar de la barra lateral del portal
              (h-10 w-10 rounded-sm con public/BA-primary.png). */}
          <div
            style={{
              width: pt(LADO_LOGO),
              height: pt(LADO_LOGO),
              backgroundColor: AMARILLO,
              borderRadius: pt(2),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: imagen embebida para imprimir */}
            <img
              src={logo}
              alt="BA"
              style={{
                width: pt(LADO_LOGO * 0.75),
                height: pt((LADO_LOGO * 0.75) / LOGO_PROPORCION),
              }}
            />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: pt(9.5), fontWeight: 700 }}>APrA</div>
            <div style={{ fontSize: pt(7.5), color: blancoSuave }}>
              Red de Calidad del Aire
            </div>
          </div>
        </div>
        <h1
          style={{
            fontSize: pt(24),
            whiteSpace: "nowrap",
            fontWeight: 700,
            margin: `${pt(14)} 0 0`,
            lineHeight: 1.1,
          }}
        >
          {titulo}
        </h1>
        <div
          style={{ fontSize: pt(11.5), marginTop: pt(4), color: blancoSuave }}
        >
          {`Estación ${v.estacion.nombre} · Reporte Mensual · ${mes}`}
        </div>
      </div>
      <div style={{ height: pt(2), backgroundColor: TURQUESA }} />
    </header>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: pt(14), breakInside: "avoid" }}>
      <h2
        style={{
          fontSize: pt(11),
          fontWeight: 700,
          color: ACENTO,
          borderBottom: `${pt(1.1)} solid ${ACENTO}`,
          padding: `0 0 ${pt(3)}`,
          margin: `0 0 ${pt(6)}`,
        }}
      >
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Tarjeta({
  rotulo,
  valor,
  unidad,
  detalle,
}: {
  rotulo: string;
  valor: string;
  unidad?: string;
  detalle?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        border: `${pt(0.75)} solid ${BORDE}`,
        borderRadius: pt(3),
        padding: `${pt(6)} ${pt(8)}`,
      }}
    >
      <div style={{ fontSize: pt(8.5), color: GRIS }}>{rotulo}</div>
      <div
        style={{
          fontSize: pt(19),
          fontWeight: 700,
          marginTop: pt(1),
          lineHeight: 1.15,
        }}
      >
        {valor}
        {unidad && (
          <span
            style={{ fontSize: pt(10), fontWeight: 600 }}
          >{` ${unidad}`}</span>
        )}
      </div>
      {detalle && (
        <div style={{ fontSize: pt(8.5), color: GRIS, marginTop: pt(1) }}>
          {detalle}
        </div>
      )}
    </div>
  );
}

function TablaSimple({ t }: { t: TablaArmada }) {
  return (
    <Tabla
      t={t}
      fuente={9.5}
      colorBorde={BORDE}
      bordeExterior={0.6}
      conGruesas={false}
      padding={`${pt(2.5)} ${pt(5)}`}
    />
  );
}

/**
 * Con varios parámetros (NOx) el resumen es una tabla: tres filas de tarjetas
 * empujarían los gráficos a la hoja siguiente.
 */
function ResumenTabla({ v }: { v: Vista }) {
  const dec = v.cfg.decimales;
  const horasMes = v.numeroDeDias * 24;
  const derecha = { textAlign: "right" } as const;
  const conDia = (valor: number | null, dia?: number) =>
    valor === null
      ? "SD"
      : `${numero(valor, dec)}${dia ? ` (día ${dia})` : ""}`;
  return (
    <TablaSimple
      t={{
        columnas: [
          { ancho: ANCHO - 4 * 105, alinear: "left" },
          { ancho: 105, alinear: "right" },
          { ancho: 105, alinear: "right" },
          { ancho: 105, alinear: "right" },
          { ancho: 105, alinear: "right" },
        ],
        gruesas: [],
        filasGruesas: [],
        filas: [
          {
            celdas: [
              `(${unidadImpresa(v.ficha(v.params[0])?.unidad ?? "").toLowerCase()})`,
              "Promedio del mes",
              "Máximo horario",
              "Máx. promedio diario",
              "Horas válidas",
            ],
            estilo: { backgroundColor: COLORES.rotulo, fontWeight: 600 },
          },
          ...v.params.map((p) => {
            const h = v.estadistico(p, "1h");
            const d = v.estadistico(p, "24h");
            const dias = v.dias(p);
            const pico = (campo: "max_1h" | "prom_24h") =>
              dias
                .filter((x) => x[campo] !== null)
                .sort((a, b) => (b[campo] ?? 0) - (a[campo] ?? 0))[0]?.dia;
            const sd = (e: typeof h) => !e || e.n === 0;
            return {
              celdas: [
                v.nombre(p),
                sd(h) ? "SD" : numero(h?.media ?? null, dec),
                sd(h) ? "SD" : conDia(h?.maximo ?? null, pico("max_1h")),
                sd(d) ? "SD" : conDia(d?.maximo ?? null, pico("prom_24h")),
                `${numero(((h?.n ?? 0) / horasMes) * 100, 0)} % (${h?.n ?? 0})`,
              ],
              estilosCelda: [
                { fontWeight: 700 },
                derecha,
                derecha,
                derecha,
                derecha,
              ],
            };
          }),
        ],
      }}
    />
  );
}

function Resumen({ v }: { v: Vista }) {
  if (v.varios) return <ResumenTabla v={v} />;
  const dec = v.cfg.decimales;
  const horasMes = v.numeroDeDias * 24;
  const p = v.params[0];
  const h = v.estadistico(p, "1h");
  const d = v.estadistico(p, "24h");
  const unidad = unidadImpresa(v.ficha(p)?.unidad ?? "").toLowerCase();
  const dias = v.dias(p);
  const diaDe = (campo: "max_1h" | "prom_24h") =>
    dias
      .filter((x) => x[campo] !== null)
      .sort((a, b) => (b[campo] ?? 0) - (a[campo] ?? 0))[0];
  const pico = diaDe("max_1h");
  const picoDiario = diaDe("prom_24h");
  const mes = v.mesTitulo.split(" ")[0].toLowerCase();
  const sd = (e: typeof h) => !e || e.n === 0;
  return (
    <div style={{ display: "flex", gap: pt(7) }}>
      <Tarjeta
        rotulo="Promedio del mes"
        valor={sd(h) ? "SD" : numero(h?.media ?? null, dec)}
        unidad={sd(h) ? undefined : unidad}
        detalle={`media de ${h?.n ?? 0} horas válidas`}
      />
      <Tarjeta
        rotulo="Máximo horario"
        valor={sd(h) ? "SD" : numero(h?.maximo ?? null, dec)}
        unidad={sd(h) ? undefined : unidad}
        detalle={pico ? `el ${pico.dia} de ${mes}` : undefined}
      />
      <Tarjeta
        rotulo="Máximo promedio diario"
        valor={sd(d) ? "SD" : numero(d?.maximo ?? null, dec)}
        unidad={sd(d) ? undefined : unidad}
        detalle={
          picoDiario
            ? `el ${picoDiario.dia} de ${mes}`
            : "ningún día con promedio válido"
        }
      />
      <Tarjeta
        rotulo="Horas válidas"
        valor={`${numero(((h?.n ?? 0) / horasMes) * 100, 0)} %`}
        detalle={`${h?.n ?? 0} de ${horasMes} horas`}
      />
    </div>
  );
}

/**
 * La etapa de la Res. 68 contra la que se evaluó el mes ("3ra etapa"): la vigente
 * el primer día del mes (reporte.mensual_excedencias). Null si el contaminante no
 * tiene límites de corto plazo.
 */
function etapaDelMes(v: Vista): string | null {
  const e = v.excedencias()[0];
  return e ? etapaDe(e.norma) : null;
}

function Excedencias({ v }: { v: Vista }) {
  const exc = v.excedencias();
  if (exc.length === 0) {
    return (
      <p style={{ fontSize: pt(9), color: GRIS, margin: 0 }}>
        La Res. 68/APRA/21 no fija un valor límite de corto plazo para este
        contaminante.
      </p>
    );
  }
  const dec = v.cfg.decimales;
  const derecha = { textAlign: "right" } as const;
  const valorLimite = (e: Excedencia) =>
    textoLimite(e, v.nombre(e.parameter_code), v.varios)
      .replace(/ \(Res\. 68\/APRA\/21[^)]*\)$/, "")
      .replace("Promedios móviles 8 hs", "Promedio móvil de 8 h")
      .replace("Promedios 8 hs", "Promedio de 8 h")
      .replace("Promedios 24 hs", "Promedio de 24 h")
      .replace("Promedios 1 hora", "Promedio de 1 h")
      .replace(/ (PPM|PPB)$/, (u) => u.toLowerCase());
  return (
    <>
      <TablaSimple
        t={{
          columnas: [
            { ancho: ANCHO - 3 * 95, alinear: "left" },
            { ancho: 95, alinear: "right" },
            { ancho: 95, alinear: "right" },
            { ancho: 95, alinear: "right" },
          ],
          gruesas: [],
          filasGruesas: [],
          filas: [
            {
              celdas: [
                "Valor límite",
                "Ventanas evaluadas",
                "Máximo del mes",
                "Excedencias",
              ],
              estilo: { backgroundColor: COLORES.rotulo, fontWeight: 600 },
            },
            ...exc.map((e) => ({
              celdas: [
                valorLimite(e),
                String(e.n_evaluados),
                e.maximo === null
                  ? "SD"
                  : `${numero(e.maximo, dec)} ${unidadImpresa(e.unidad).toLowerCase()}`,
                String(e.n_excedencias),
              ],
              estilosCelda: [
                undefined,
                derecha,
                derecha,
                e.n_excedencias > 0
                  ? { ...derecha, fontWeight: 700, backgroundColor: "#fde2e1" }
                  : { ...derecha, fontWeight: 700 },
              ],
            })),
          ],
        }}
      />
      <p style={{ fontSize: pt(8.5), color: GRIS, margin: `${pt(4)} 0 0` }}>
        Una excedencia es una ventana válida por encima del valor límite
        (igualarlo no lo excede). No equivale a incumplir la norma, que se
        evalúa con otra forma de cumplimiento.
      </p>
    </>
  );
}

/**
 * Qué límites entran en el gráfico: el más bajo que quede cerca de los datos
 * se dibuja; los demás van a la nota "fuera de escala".
 */
function limitesDelGrafico(
  v: Vista,
  exc: Excedencia[],
  series: SerieGrafico[],
): { limite?: LimiteGrafico; nota?: string } {
  if (exc.length === 0) return {};
  const maxDatos = Math.max(
    0,
    ...series.flatMap((s) => s.valores).filter((x): x is number => x !== null),
  );
  // Sin datos no hay escala con la que comparar: ni línea ni nota.
  if (maxDatos === 0) return {};
  const dec = v.cfg.decimales;
  const cerca = exc
    .filter((e) => e.limite <= maxDatos * 1.5)
    .sort((a, b) => a.limite - b.limite)[0];
  const lejos = exc.filter((e) => e !== cerca);
  const unidad = unidadImpresa(exc[0].unidad).toLowerCase();
  const ventana = (w: string) =>
    w === "1h" ? "1 h" : w === "8h" ? "8 h" : "24 h";
  return {
    limite: cerca
      ? {
          valor: cerca.limite,
          // La ventana (y el parámetro, si hay varios) va en el rótulo: en el
          // NOx, los 106 ppb son del NO2 horario, no del NO ni del NOx.
          etiqueta: `límite${v.varios ? ` ${v.nombre(cerca.parameter_code)}` : ""} ${ventana(cerca.window_code)}: ${numero(cerca.limite, cerca.limite % 1 ? 1 : 0)} ${unidad}`,
          color: "#b42318",
        }
      : undefined,
    nota:
      lejos.length > 0
        ? `${lejos.length > 1 ? "Límites" : "Límite"} (${lejos
            .map((e) => numero(e.limite, e.limite % 1 ? 1 : 0))
            .join(
              " y ",
            )} ${unidad}) fuera de escala: el máximo graficado es ${numero(maxDatos, dec)} ${unidad}`
        : undefined,
  };
}

function Leyenda({
  items,
  nota,
}: {
  items: { nombre: string; color: string; grosor?: number }[];
  nota?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: pt(12),
        fontSize: pt(8.5),
        marginBottom: pt(2),
      }}
    >
      {items.map((it) => (
        <span
          key={it.nombre}
          style={{ display: "flex", alignItems: "center", gap: pt(4) }}
        >
          <span
            style={{
              display: "inline-block",
              width: pt(14),
              height: pt(it.grosor ?? 1.5),
              backgroundColor: it.color,
            }}
          />
          {it.nombre}
        </span>
      ))}
      {nota && (
        <span style={{ marginLeft: "auto", color: GRIS, maxWidth: pt(260) }}>
          {nota}
        </span>
      )}
    </div>
  );
}

const graficoNuevo = {
  grilla: GRILLA,
  puntos: false,
  suavizar: true,
  halo: "#ffffff",
  marco: null,
  colorRotulos: GRIS,
  familia: FUENTE,
} as const;

function GraficoA({
  series,
  exc,
  v,
  etiquetasX,
  alto,
}: {
  series: SerieGrafico[];
  exc: Excedencia[];
  v: Vista;
  etiquetasX: string[];
  alto: number;
}) {
  const { limite, nota } = limitesDelGrafico(v, exc, series);
  return (
    <div>
      <Leyenda
        items={[
          ...series.map((s) => ({
            nombre: s.nombre,
            color: s.color,
            grosor: s.grosor,
          })),
          ...(limite
            ? [{ nombre: limite.etiqueta, color: limite.color ?? "#b42318" }]
            : []),
        ]}
        nota={nota}
      />
      <Grafico
        ancho={ANCHO}
        alto={alto}
        etiquetasX={etiquetasX}
        series={series}
        escala={null}
        limites={limite ? [limite] : []}
        tamanoRotulos={7.5}
        {...graficoNuevo}
      />
    </div>
  );
}

function ConcentracionDiaria({ v }: { v: Vista }) {
  const diasX = v.dias(v.params[0]).map((d) => String(d.dia));
  const serie = (
    p: string,
    campo: "prom_24h" | "max_1h",
    nombre: string,
    color: string,
  ): SerieGrafico => ({
    nombre,
    color,
    grosor: 1.5,
    valores: v.dias(p).map((d) => d[campo]),
  });
  if (!v.varios) {
    const p = v.params[0];
    return (
      <GraficoA
        v={v}
        alto={150}
        etiquetasX={diasX}
        exc={v.excedencias(p).filter((e) => e.window_code !== "8h")}
        series={[
          serie(p, "prom_24h", "Promedio 24 h", SERIES[0]),
          serie(p, "max_1h", "Máximo horario", SERIES[1]),
        ]}
      />
    );
  }
  // Con varios parámetros, un gráfico por medida, un color por parámetro.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: pt(8) }}>
      {(["prom_24h", "max_1h"] as const).map((campo) => (
        <div key={campo}>
          <div
            style={{ fontSize: pt(9), fontWeight: 700, marginBottom: pt(2) }}
          >
            {campo === "prom_24h" ? "Promedio 24 h" : "Máximo horario"}
          </div>
          <GraficoA
            v={v}
            alto={110}
            etiquetasX={diasX}
            exc={v
              .excedencias()
              .filter((e) =>
                campo === "prom_24h"
                  ? e.window_code === "24h"
                  : e.window_code === "1h",
              )}
            series={v.params.map((p, i) =>
              serie(p, campo, v.nombre(p), SERIES[i % SERIES.length]),
            )}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * El perfil horario en tres paneles chicos (hábiles, sábado, domingo y
 * feriado), cada uno con el promedio mensual en gris de referencia y la misma
 * escala. En un solo gráfico las cuatro líneas se pisan.
 */
function PerfilHorario({ v }: { v: Vista }) {
  const p = v.cfg.parametroPerfil;
  const valores = (g: GrupoPerfil) =>
    ORDEN_HORAS_PERFIL.map((h) => v.perfil(p, g, h)?.valor ?? null);
  const mensual: SerieGrafico = {
    nombre: "Mensual",
    color: "#9aa3ae",
    grosor: 1.2,
    valores: valores("mensual"),
  };
  const paneles = [
    ["lunes_a_viernes", "Lunes a viernes", SERIES[0]],
    ["sabado", "Sábado", SERIES[1]],
    ["domingo_feriado", "Domingo y feriado", SERIES[2]],
  ] as const;
  const series = paneles.map(([g, nombre, color]) => ({
    nombre,
    color,
    grosor: 1.8,
    valores: valores(g),
  }));
  // Una sola escala para los tres: si no, no se pueden comparar.
  const escala = maximoDelEje(null, [mensual, ...series]);
  const anchoPanel = (ANCHO - 2 * 10) / 3;
  // Una hora rotulada cada seis, para que entren en el panel.
  const etiquetas = ORDEN_HORAS_PERFIL.map((h, i) =>
    i % 6 === 1 ? String(h).padStart(2, "0") : "",
  );
  return (
    <div>
      <div style={{ display: "flex", gap: pt(10) }}>
        {series.map((s) => (
          <div key={s.nombre} style={{ width: pt(anchoPanel) }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: pt(4),
                fontSize: pt(9),
                fontWeight: 700,
                marginBottom: pt(2),
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: pt(12),
                  height: pt(2),
                  backgroundColor: s.color,
                }}
              />
              {s.nombre}
            </div>
            <Grafico
              ancho={anchoPanel}
              alto={110}
              etiquetasX={etiquetas}
              series={[mensual, s]}
              escala={escala}
              tamanoRotulos={7}
              {...graficoNuevo}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: pt(4),
          fontSize: pt(8.5),
          color: GRIS,
          marginTop: pt(3),
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: pt(12),
            height: pt(1.2),
            backgroundColor: mensual.color,
          }}
        />
        Promedio mensual, de referencia. Hora de inicio de cada intervalo, en
        hora de Buenos Aires: 23 es de 23:00 a 00:00.
      </div>
    </div>
  );
}

function Metodo({ v }: { v: Vista }) {
  const items: string[] = [
    "Los valores son los promedios VALIDADOS de la red, calculados automáticamente a partir de las mediciones minuto a minuto de cada analizador. Incluyen las revisiones manuales del área técnica (invalidaciones y reincorporaciones) y las horas cargadas a mano después de un corte de transmisión.",
    "Criterios de validez: una hora es válida con al menos 45 minutos válidos (75 %); un bloque de 8 horas, con al menos 6 horas válidas; un día (de 00 a 24 h), con al menos 18 horas válidas. Un minuto en alarma, calibración o servicio no es válido.",
    "SD (Sin Dato): no hubo ninguna medición en esa ventana. DND (Dato No Disponible): hubo mediciones, pero no alcanzan el criterio de validez.",
    "Los estadísticos usan solo ventanas válidas. Percentiles por interpolación lineal (como PERCENTIL de Excel); desvío estándar muestral.",
    `Excedencias contra la Res. 68/APRA/21 (Anexo I) en la etapa vigente el primer día del mes${etapaDelMes(v) ? ` (para este mes, la ${etapaDelMes(v)})` : ""}. Las medias móviles de 8 horas se cuentan en el mes en que TERMINAN.`,
    NOTA_PERFIL,
    "Domingos y feriados según el calendario oficial del Ministerio del Interior (feriados nacionales, días no laborables con fines turísticos y feriados especiales que rigen en la Ciudad). Los días no laborables optativos (religiosos) se cuentan como días hábiles.",
    "Los gráficos usan la escala de los datos. Un valor límite muy por encima de lo medido no se dibuja (aplastaría la serie contra el eje): se indica como fuera de escala.",
    NOTA_EPA.replace(/^\* /, ""),
  ];
  return (
    <div style={{ fontSize: pt(9.5), color: TINTA, lineHeight: 1.35 }}>
      <ul style={{ margin: 0, paddingLeft: pt(12) }}>
        {items.map((t) => (
          <li key={t.slice(0, 24)} style={{ marginBottom: pt(4) }}>
            {t}
          </li>
        ))}
      </ul>
      <h3
        style={{
          fontSize: pt(9.5),
          fontWeight: 700,
          margin: `${pt(6)} 0 ${pt(3)}`,
        }}
      >
        Instrumentos y límite de detección
      </h3>
      {v.params.map((p) => {
        const f = v.ficha(p);
        const ld = v.ld(p);
        return (
          <p key={p} style={{ margin: `0 0 ${pt(2)}` }}>
            {`${v.nombre(p)}: ${f?.instrumentos ?? "sin instrumento registrado en el mes"}. ${
              ld !== null
                ? `Límite de detección ${menorQueLD(ld).slice(1)} ${unidadImpresa(f?.unidad ?? "")}: una hora por debajo se publica «${menorQueLD(ld)}».`
                : "Límite de detección no relevado."
            }`}
          </p>
        );
      })}
    </div>
  );
}

const cuerpo: CSSProperties = { padding: `${pt(30)} ${pt(MARGEN)} 0` };

export function ReporteNuevo({ reporte }: { reporte: ReporteMensual }) {
  const v = vista(reporte);
  const pl = PLANTILLAS.nuevo;
  const pie = `Versión nueva v${pl.version} (${pl.fecha}) · Generado el ${v.generado} desde SIRCA`;
  const fs = v.varios ? 6.5 : 8;
  const tabla = (t: TablaArmada, tamano = fs) => (
    <Tabla
      t={t}
      fuente={tamano}
      colorBorde={BORDE}
      conGruesas={false}
      padding={`${pt(0.6)} ${pt(2)}`}
    />
  );
  const total = 4;
  const hoja = (n: number, hijos: ReactNode) => (
    <Hoja pie={pie} numero={n} total={total} colorPie={GRIS}>
      {hijos}
    </Hoja>
  );
  const perfil = (
    <Seccion titulo="Perfil horario por tipo de día">
      <PerfilHorario v={v} />
    </Seccion>
  );

  return (
    <div style={{ fontFamily: FUENTE, color: TINTA, fontSize: pt(9.5) }}>
      <style>{`${CSS_FUENTE}\n${CSS_HOJAS}`}</style>

      {hoja(
        1,
        <>
          <Banda v={v} />
          <div style={{ ...cuerpo, paddingTop: pt(16) }}>
            <Seccion titulo="Resumen del mes">
              <Resumen v={v} />
            </Seccion>
            <Seccion
              titulo={`Excedencias · Res. 68/APRA/21${etapaDelMes(v) ? ` ${etapaDelMes(v)}` : ""}`}
            >
              <Excedencias v={v} />
            </Seccion>
            <Seccion titulo="Concentración diaria">
              <ConcentracionDiaria v={v} />
            </Seccion>
            {/* Con un parámetro, el perfil entra en la primera hoja. */}
            {!v.varios && perfil}
          </div>
        </>,
      )}

      {hoja(
        2,
        <div style={cuerpo}>
          {v.varios && perfil}
          <Seccion titulo={`Valores diarios (${v.cfg.unidad})`}>
            {tabla(tablaDias(v, ANCHO, COLORES))}
            <p
              style={{ fontSize: pt(8.5), color: GRIS, margin: `${pt(4)} 0 0` }}
            >
              Promedio 24 Hs: de 00 a 24 h. Bloques de 8 h: 0 a 8, 8 a 16 y 16 a
              24 h. Máximo y mínimo: entre las horas válidas del día. SD: sin
              dato. DND: dato no disponible.
            </p>
          </Seccion>
        </div>,
      )}

      {hoja(
        3,
        <div style={cuerpo}>
          <Seccion titulo={`Estadísticos del mes (${v.cfg.unidad})`}>
            {tabla(tablaEstadisticos(v, ANCHO, COLORES, 110))}
          </Seccion>
          <Seccion
            titulo={`Promedios horarios por tipo de día (${v.cfg.unidad})`}
          >
            {tabla(tablaPerfil(v, ANCHO, COLORES), v.varios ? 6.5 : 7.5)}
            <p
              style={{ fontSize: pt(8.5), color: GRIS, margin: `${pt(4)} 0 0` }}
            >
              {NOTA_PERFIL}
            </p>
          </Seccion>
        </div>,
      )}

      {hoja(
        4,
        <div style={cuerpo}>
          <Seccion titulo="Método y fuentes">
            <Metodo v={v} />
          </Seccion>
        </div>,
      )}
    </div>
  );
}
