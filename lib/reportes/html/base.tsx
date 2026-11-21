/**
 * @file Piezas comunes de las dos plantillas del reporte en HTML: la hoja A4,
 * la tabla, el gráfico de líneas y la leyenda.
 * @description Componentes de servidor, sin estado: el reporte se arma una vez
 * y se ve igual en pantalla que impreso (Chromium, vía Gotenberg). Todas las
 * medidas van en pt, como el PDF de la planilla contra el que se compararon.
 */

import type { CSSProperties, ReactNode } from "react";
import { numero } from "../formato";
import {
  curvaMonotona,
  type LimiteGrafico,
  maximoDelEje,
  pasoDelEje,
  type SerieGrafico,
} from "../graficos";
import { CUBIERTA, type EstiloCelda, type TablaArmada } from "../tabla";

export const pt = (n: number) => `${n}pt`;

/** Una imagen embebida (los fondos y el logo viajan en el bundle, en base64). */
export const dataUri = (b: Buffer, tipo: "jpeg" | "png") =>
  `data:image/${tipo};base64,${b.toString("base64")}`;

// ---- Hoja ---------------------------------------------------------------------------

/**
 * Una hoja A4. En pantalla, una tarjeta blanca con sombra; impresa, una página.
 * El pie (plantilla, versión, número de página) va adentro: la paginación la
 * decide cada plantilla, así que se sabe de antemano.
 */
export function Hoja({
  children,
  pie,
  numero: n,
  total,
  estilo,
  colorPie = "#555555",
}: {
  children: ReactNode;
  pie: string;
  numero: number;
  total: number;
  estilo?: CSSProperties;
  colorPie?: string;
}) {
  return (
    <section className="hoja" style={estilo}>
      {children}
      <footer
        style={{
          position: "absolute",
          bottom: pt(14),
          left: pt(28),
          right: pt(28),
          display: "flex",
          justifyContent: "space-between",
          fontSize: pt(6),
          color: colorPie,
        }}
      >
        <span>{pie}</span>
        <span>{`Página ${n} de ${total}`}</span>
      </footer>
    </section>
  );
}

/**
 * El CSS de impresión: A4 sin márgenes (los pone cada hoja), una hoja por
 * página, y los fondos de color impresos (los encabezados de la planilla).
 */
/** El gris detrás de las hojas, en pantalla. */
export const FONDO_HOJAS = "#d9dde3";

// Las hojas: lo que necesita el reporte esté donde esté (la página de impresión o
// la vista previa dentro de /reportes).
export const CSS_HOJAS = `
.hoja {
  position: relative;
  box-sizing: border-box;
  width: 210mm;
  height: 297mm;
  overflow: hidden;
  background: #ffffff;
  color: #000000;
  margin: 16px auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
`;

// Las reglas de impresión van con `body .hoja` y no con `.hoja`: esta hoja de
// estilos queda ANTES que la del reporte (CSS_HOJAS, dentro de la plantilla), y
// a igual especificidad ganaría el margen de pantalla de CSS_HOJAS. Con ese
// margen cada A4 desborda y el PDF sale con el doble de páginas.
//
// La página de impresión (/imprimir/reporte-mensual), que es solo el reporte: el
// layout raíz deja el html con overflow-hidden, y al imprimir cada hoja es una
// página A4 sin márgenes. NO va en la vista previa de /reportes: rompería el
// scroll del portal.
export const CSS_PAGINA = `
html { overflow: auto !important; background: ${FONDO_HOJAS}; }
body { margin: 0; }
@page { size: A4; margin: 0; }
@media print {
  html { background: #ffffff; }
  body .hoja { margin: 0; box-shadow: none; break-after: page; }
  body .hoja:last-child { break-after: auto; }
}
`;

// ---- Tabla ---------------------------------------------------------------------------

const FINO = 0.6;

function estilo(e?: EstiloCelda): CSSProperties {
  if (!e) return {};
  return {
    ...(e.backgroundColor ? { backgroundColor: e.backgroundColor } : {}),
    ...(e.fontWeight ? { fontWeight: e.fontWeight } : {}),
    ...(e.fontSize ? { fontSize: pt(e.fontSize) } : {}),
    ...(e.textAlign ? { textAlign: e.textAlign } : {}),
  };
}

/**
 * Una tabla armada por tablas.ts. Con `border-collapse`, entre dos bordes gana
 * el más grueso: el contorno y los separadores gruesos se ponen donde van y el
 * resto queda fino.
 */
export function Tabla({
  t,
  fuente,
  colorBorde = "#000000",
  bordeExterior = FINO,
  grueso = 1.4,
  conGruesas = true,
  padding = "0.3pt 2pt",
  alturaLinea,
  filasEnCaja = [],
}: {
  t: TablaArmada;
  fuente: number;
  colorBorde?: string;
  bordeExterior?: number;
  grueso?: number;
  /** false: sin separadores gruesos (la plantilla nueva). */
  conGruesas?: boolean;
  padding?: string;
  /**
   * Alto de la línea de texto en pt, igual para todas las celdas: fija el paso
   * de las filas aunque una columna tenga letra más grande (la planilla: valores
   * en 8,3 pt y días en 9,2 pt, una fila cada 9,6 pt). Sin él, 1,15 de la letra.
   */
  alturaLinea?: number;
  /**
   * Filas cuyas celdas van encerradas en línea gruesa (los encabezados de la
   * planilla: el mes, "Promedio 24 Hs", "PROMEDIO 8 HS", "0 a 8"...).
   */
  filasEnCaja?: number[];
}) {
  const linea = (g: number) => `${g}pt solid ${colorBorde}`;
  return (
    <table
      style={{
        borderCollapse: "collapse",
        tableLayout: "fixed",
        width: pt(t.columnas.reduce((s, c) => s + c.ancho, 0)),
        border: linea(bordeExterior),
        fontSize: pt(fuente),
        lineHeight: alturaLinea ? pt(alturaLinea) : 1.15,
      }}
    >
      <colgroup>
        {t.columnas.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: columnas fijas
          <col key={i} style={{ width: pt(c.ancho) }} />
        ))}
      </colgroup>
      <tbody>
        {t.filas.map((fila, i) => {
          let col = 0;
          return (
            <tr
              // biome-ignore lint/suspicious/noArrayIndexKey: filas fijas
              key={i}
              style={{
                ...(fila.alto ? { height: pt(fila.alto) } : {}),
                ...estilo(fila.estilo),
              }}
            >
              {fila.celdas.map((texto, j) => {
                const span = fila.spans?.[j] ?? 1;
                const desde = col;
                col += span;
                if (texto === CUBIERTA) return null;
                const ocupa = fila.filasQueOcupa?.[j] ?? 1;
                const ultima = i + ocupa - 1;
                const gruesaIzq =
                  conGruesas && desde > 0 && t.gruesas.includes(desde);
                const gruesaAbajo =
                  conGruesas && t.filasGruesas.includes(ultima);
                return (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: celdas fijas
                    key={j}
                    colSpan={span > 1 ? span : undefined}
                    rowSpan={ocupa > 1 ? ocupa : undefined}
                    style={{
                      border: linea(
                        conGruesas && filasEnCaja.includes(i) ? grueso : FINO,
                      ),
                      ...(gruesaIzq ? { borderLeft: linea(grueso) } : {}),
                      ...(gruesaAbajo ? { borderBottom: linea(grueso) } : {}),
                      padding,
                      textAlign: t.columnas[desde]?.alinear ?? "center",
                      verticalAlign: "middle",
                      overflow: "hidden",
                      ...estilo(fila.estilosCelda?.[j]),
                    }}
                  >
                    {texto}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---- Gráfico de líneas --------------------------------------------------------------

type Punto = [number, number];

export function Grafico({
  ancho,
  alto,
  etiquetasX,
  series,
  escala,
  paso: pasoFijo,
  limites = [],
  fondo = "#ffffff",
  imagenFondo,
  grilla = "#d0d0d0",
  grosorGrilla = 0.4,
  marco = "#000000",
  tituloY,
  tamanoRotulos = 6,
  puntos = true,
  categorias = false,
  suavizar = false,
  halo,
  colorRotulos = "#000000",
  familia,
}: {
  ancho: number;
  alto: number;
  etiquetasX: string[];
  series: SerieGrafico[];
  /** El máximo fijo del eje Y (versión clásica); null = automático. */
  escala: number | null;
  /** El paso fijo de las marcas del eje Y, si el eje queda en `escala`. */
  paso?: number;
  /** Las líneas horizontales de los límites (una por norma). */
  limites?: LimiteGrafico[];
  fondo?: string;
  /** Imagen (data URI) estirada sobre el área de trazado. */
  imagenFondo?: string;
  grilla?: string;
  grosorGrilla?: number;
  /** Color del marco del área de trazado; null = sin marco, solo la base. */
  marco?: string | null;
  /** Título del eje Y, vertical y en negrita (la planilla). */
  tituloY?: string;
  tamanoRotulos?: number;
  /** Marca cada valor con un punto (la planilla); la nueva dibuja solo la línea. */
  puntos?: boolean;
  /**
   * Eje de categorías, como el de Excel: cada valor va en el centro de su
   * franja, así el primero y el último quedan separados del borde.
   */
  categorias?: boolean;
  /** Curva monótona en lugar de segmentos rectos. */
  suavizar?: boolean;
  /** Color de un borde alrededor de cada línea, para que las que se cruzan se separen. */
  halo?: string;
  colorRotulos?: string;
  familia?: string;
}) {
  const titulo = tituloY ? 12 : 0;
  const izq = 30 + titulo;
  const der = 6;
  const arr = 6;
  // Rótulos largos (el perfil horario: "23:00 a\n00:00") van en dos renglones.
  const dosRenglones = etiquetasX.some((e) => e.includes("\n"));
  const abajo = dosRenglones ? 22 : 12;
  const w = ancho - izq - der;
  const h = alto - arr - abajo;
  const yMax = maximoDelEje(escala, series, limites);
  const paso =
    pasoFijo !== undefined && yMax === escala ? pasoFijo : pasoDelEje(yMax);
  const n = etiquetasX.length;
  const x = (i: number) =>
    categorias
      ? izq + ((i + 0.5) * w) / n
      : izq + (n <= 1 ? w / 2 : (i * w) / (n - 1));
  const y = (v: number) => arr + h - (Math.min(v, yMax) / yMax) * h;
  const marcas: number[] = [];
  for (let k = 0; k * paso <= yMax + paso / 1000; k++) marcas.push(k * paso);
  // Tantos decimales como tenga el paso: 2,5 lleva uno, 0,25 dos.
  const decimalesEje = Math.min(
    3,
    (String(Number(paso.toPrecision(6))).split(".")[1] ?? "").length,
  );
  const tramosDe = (s: SerieGrafico): Punto[][] => {
    // Un tramo por racha sin huecos: un día sin dato corta la línea en vez de
    // unir los vecinos como si hubiera un valor en el medio.
    const tramos: Punto[][] = [];
    let actual: Punto[] = [];
    s.valores.forEach((v, i) => {
      if (v === null) {
        if (actual.length) tramos.push(actual);
        actual = [];
      } else {
        actual.push([x(i), y(v)]);
      }
    });
    if (actual.length) tramos.push(actual);
    return tramos.filter((t) => t.length > 1);
  };
  const d = (t: Punto[]) =>
    suavizar ? curvaMonotona(t) : `M${t.map((q) => q.join(",")).join(" L")}`;
  const fuenteRotulos = dosRenglones ? tamanoRotulos - 1.5 : tamanoRotulos;

  return (
    <svg
      width={pt(ancho)}
      height={pt(alto)}
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-label={series.map((s) => s.nombre).join(", ")}
      style={{ display: "block", fontFamily: familia, overflow: "visible" }}
    >
      {imagenFondo ? (
        <image
          href={imagenFondo}
          x={izq}
          y={arr}
          width={w}
          height={h}
          preserveAspectRatio="none"
        />
      ) : (
        <rect x={izq} y={arr} width={w} height={h} fill={fondo} />
      )}
      {marcas.map((v) => (
        <line
          key={`g${v}`}
          x1={izq}
          x2={izq + w}
          y1={y(v)}
          y2={y(v)}
          stroke={grilla}
          strokeWidth={grosorGrilla}
        />
      ))}
      {limites.map((l) => (
        <line
          key={`${l.valor}${l.etiqueta}`}
          x1={izq}
          x2={izq + w}
          y1={y(l.valor)}
          y2={y(l.valor)}
          stroke={l.color ?? "#e00000"}
          strokeWidth={2}
        />
      ))}
      {series.map((s) => {
        const grosor = s.grosor ?? 1.2;
        return (
          <g key={s.nombre}>
            {halo &&
              tramosDe(s).map((t, k) => (
                <path
                  // biome-ignore lint/suspicious/noArrayIndexKey: tramos fijos
                  key={`h${k}`}
                  d={d(t)}
                  fill="none"
                  stroke={halo}
                  strokeWidth={grosor + 2.2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            {tramosDe(s).map((t, k) => (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: tramos fijos
                key={`l${k}`}
                d={d(t)}
                fill="none"
                stroke={s.color}
                strokeWidth={grosor}
                strokeLinejoin="round"
                strokeLinecap={suavizar ? "round" : "butt"}
              />
            ))}
            {s.valores.map((v, i) =>
              // Sin puntos, solo se marca un valor aislado (sin vecino de
              // ningún lado), que si no, no se vería.
              v === null ||
              (!puntos &&
                !(
                  s.valores[i - 1] == null && s.valores[i + 1] == null
                )) ? null : (
                <circle
                  // biome-ignore lint/suspicious/noArrayIndexKey: posición fija en el eje
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  // El punto crece con la línea (en la planilla, 2,5 pt sobre 2).
                  r={grosor * 1.25}
                  fill={s.color}
                />
              ),
            )}
          </g>
        );
      })}
      {marco ? (
        <rect
          x={izq}
          y={arr}
          width={w}
          height={h}
          fill="none"
          stroke={marco}
          strokeWidth={0.75}
        />
      ) : (
        <line
          x1={izq}
          x2={izq + w}
          y1={arr + h}
          y2={arr + h}
          stroke="#8a94a3"
          strokeWidth={0.75}
        />
      )}
      {tituloY && (
        <text
          transform={`translate(7 ${arr + h / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={tamanoRotulos + 1}
          fontWeight={700}
          fill="#000000"
        >
          {tituloY}
        </text>
      )}
      {marcas.map((v) => (
        <text
          key={`y${v}`}
          x={izq - 3}
          y={y(v) + tamanoRotulos * 0.35}
          textAnchor="end"
          fontSize={tamanoRotulos}
          fill={colorRotulos}
        >
          {numero(v, decimalesEje)}
        </text>
      ))}
      {etiquetasX.map((e, i) =>
        e ? (
          <text
            // biome-ignore lint/suspicious/noArrayIndexKey: posición fija en el eje
            key={i}
            x={x(i)}
            y={arr + h + 2 + fuenteRotulos}
            textAnchor="middle"
            fontSize={fuenteRotulos}
            fill={colorRotulos}
          >
            {e.split("\n").map((renglon, k) => (
              <tspan
                key={renglon}
                x={x(i)}
                dy={k === 0 ? 0 : fuenteRotulos * 1.15}
              >
                {renglon}
              </tspan>
            ))}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/**
 * La leyenda de la planilla: un cuadro blanco con borde, una serie por
 * renglón (o en columnas), alineada a la izquierda, con la línea y su marcador.
 */
export function Leyenda({
  items,
  tamano = 6,
  columnas = 1,
}: {
  items: {
    nombre: string;
    color: string;
    grosor?: number;
    marcador?: boolean;
  }[];
  tamano?: number;
  /** En cuántas columnas se reparten las series (el perfil usa dos). */
  columnas?: number;
}) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: `${pt(0.75)} solid #000000`,
        padding: `${pt(3)} ${pt(5)}`,
        display: "grid",
        gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`,
        rowGap: pt(2),
        columnGap: pt(6),
        fontSize: pt(tamano),
        lineHeight: 1.1,
      }}
    >
      {items.map((it) => {
        const g = it.grosor ?? 1.5;
        return (
          <div
            key={it.nombre}
            style={{ display: "flex", alignItems: "center", gap: pt(4) }}
          >
            <span
              style={{
                position: "relative",
                flex: `0 0 ${pt(18)}`,
                height: pt(Math.max(g * 2.5, 5)),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  display: "block",
                  width: "100%",
                  height: pt(g),
                  backgroundColor: it.color,
                }}
              />
              {it.marcador && (
                <span
                  style={{
                    position: "absolute",
                    width: pt(g * 2.5),
                    height: pt(g * 2.5),
                    borderRadius: "50%",
                    backgroundColor: it.color,
                  }}
                />
              )}
            </span>
            <span>{it.nombre}</span>
          </div>
        );
      })}
    </div>
  );
}
