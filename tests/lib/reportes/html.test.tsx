// @vitest-environment node
//
// Las dos plantillas tienen que poder renderizarse con cualquier reporte: con un
// parámetro o con tres, con días sin dato, con y sin excedencias. Lo que se
// verifica es el HTML que sale (hojas, títulos, gráficos); los textos de las
// tablas ya los verifica tablas.test.ts, y el PDF lo imprime Chromium.
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  curvaMonotona,
  maximoDelEje,
  pasoDelEje,
} from "@/lib/reportes/graficos";
import { CSS_PAGINA } from "@/lib/reportes/html/base";
import { ReporteClasico } from "@/lib/reportes/html/clasico";
import { ReporteNuevo } from "@/lib/reportes/html/nuevo";
import type { ReporteMensual } from "@/lib/reportes/models";
import { reporteCO, reporteNOx } from "./fixture";
import { coSeptiembre, noxSeptiembre, pm10Septiembre } from "./septiembre";

const PLANTILLAS = {
  clasico: (r: ReporteMensual) => <ReporteClasico reporte={r} />,
  nuevo: (r: ReporteMensual) => <ReporteNuevo reporte={r} />,
} as const;
const HOJAS = { clasico: 5, nuevo: 4 } as const;

const html = (e: ReactElement) => renderToStaticMarkup(e);
const cuenta = (s: string, x: string) => s.split(x).length - 1;

function sinDatos(): ReporteMensual {
  const r = reporteNOx();
  r.contaminante = "pm25";
  r.ficha = [
    {
      ...r.ficha[0],
      parameter_code: "pm25",
      display_name: "PM₂.₅",
      unidad: "ug/m3",
      limite_deteccion: null,
      instrumentos: null,
    },
  ];
  r.dias = r.dias
    .filter((d) => d.parameter_code === "no")
    .map((d) => ({
      ...d,
      parameter_code: "pm25",
      prom_24h: null,
      prom_24h_estado: "SD" as const,
      max_1h: null,
      min_1h: null,
      horas_estado: "SD" as const,
    }));
  r.estadisticos = [];
  r.excedencias = [];
  r.perfil = [];
  return r;
}

describe.each(["clasico", "nuevo"] as const)("plantilla %s", (plantilla) => {
  const render = (r: ReporteMensual) => html(PLANTILLAS[plantilla](r));

  it.each([
    ["CO", reporteCO],
    ["NOx", reporteNOx],
    ["un mes sin ningún dato ni límite", sinDatos],
    ["CO de septiembre", coSeptiembre],
    ["NOx de septiembre", noxSeptiembre],
    ["PM10 de septiembre", pm10Septiembre],
  ] as const)("%s: hojas A4 numeradas, con gráficos", (_, reporte) => {
    const s = render(reporte());
    const n = HOJAS[plantilla];
    expect(cuenta(s, 'class="hoja"')).toBe(n);
    expect(s).toContain(`Página 1 de ${n}`);
    expect(s).toContain(`Página ${n} de ${n}`);
    // El CSS de impresión es de la página, no del reporte: la vista previa de
    // /reportes no puede tocar el html del portal.
    expect(s).not.toContain("@page");
    expect(s).not.toContain("overflow: auto !important");
    expect(cuenta(s, "<svg")).toBeGreaterThan(0);
    expect(s).not.toContain("NaN");
    expect(s).not.toContain("undefined");
  });

  it("la versión va en el pie solo en la nueva (la planilla no tenía pie)", () => {
    // La versión (v1.5) y la fecha del diseño, en el pie de cada hoja.
    const conVersion = /v\d+\.\d+ \(2026-\d\d-\d\d\)/;
    if (plantilla === "nuevo") expect(render(reporteCO())).toMatch(conVersion);
    else expect(render(reporteCO())).not.toMatch(conVersion);
  });
});

describe("plantilla clásica", () => {
  it("los percentiles van como la planilla: una celda con 95 y 98 al lado", () => {
    const s = html(<ReporteClasico reporte={coSeptiembre()} />);
    expect(s).toMatch(/rowSpan="2"[^>]*>Percentiles</);
    expect(s).toContain(">95</td>");
    expect(s).toContain(">98</td>");
    expect(s).not.toContain("Percentil 95");
  });

  it("en el NOx, el estándar del gráfico horario dice que es del NO2", () => {
    const s = html(<ReporteClasico reporte={noxSeptiembre()} />);
    expect(s).toContain(
      "Estándar de Calidad de Aire para NO2 en 1 hora: 106 PPB (Res. 68/APRA/21, 3ra etapa)",
    );
  });

  it("con la Ley 20284 (ACUMAR), cada límite con su número y su línea", () => {
    const r = noxSeptiembre();
    r.excedencias = [
      {
        ...r.excedencias[0],
        parameter_code: "nox",
        norma: "Ley 20284",
        limite: 450,
        n_excedencias: 2,
      },
      ...r.excedencias,
    ];
    const s = html(<ReporteClasico reporte={r} />);
    expect(s).toContain(
      "Cantidad de períodos de 1 hora que excedieron la norma de Calidad de Aire (*1) y (*2)",
    );
    expect(s).toContain("Promedios 1 hora NOx (*1)");
    expect(s).toContain("Promedios 1 hora NO2 (*2)");
    expect(s).toContain(
      "(*1)Nivel admisible para NOx promedio en 1 hora (expresado como NO2): 450 PPB (Ley Nacional 20284)",
    );
    expect(s).toContain(
      "(*2)Promedios 1 hora de NO2: 106 PPB (Res. 68/APRA/21, 3ra etapa)",
    );
    // Las dos líneas en el gráfico horario: la de la ley en rojo, la de la
    // Res. 68 en azul.
    expect(s).toMatch(/<line[^>]*stroke="#e00000"/);
    expect(s).toMatch(/<line[^>]*stroke="#1a2fd6"/);
  });
});

describe("CSS de la página de impresión", () => {
  // CSS_PAGINA queda antes que el CSS_HOJAS de la plantilla: con `.hoja` a
  // secas ganaba el margen de pantalla y cada A4 desbordaba a dos páginas.
  it("las reglas de impresión le ganan al margen de pantalla de las hojas", () => {
    expect(CSS_PAGINA).toMatch(/body \.hoja \{ margin: 0;/);
    expect(CSS_PAGINA).not.toMatch(/^\s*\.hoja \{/m);
  });
});

describe("plantilla nueva", () => {
  it("carga Source Sans 3 de public/, con el basePath", () => {
    const s = html(<ReporteNuevo reporte={reporteCO()} />);
    expect(s).toContain("font-family: 'Source Sans 3'");
    expect(s).toMatch(
      /url\('[^']*\/fonts\/source-sans-3\/source-sans-3-latin-400-normal\.woff'\)/,
    );
  });

  it("un límite muy por encima de los datos no se dibuja: se nombra", () => {
    // CO: máximos de ~1 ppm contra límites de 9 y 35 ppm.
    const s = html(<ReporteNuevo reporte={coSeptiembre()} />);
    expect(s).toContain("fuera de escala: el máximo graficado");
  });

  it("un mes sin datos no habla de escala", () => {
    const r = reporteCO();
    r.dias = r.dias.map((d) => ({ ...d, prom_24h: null, max_1h: null }));
    const s = html(<ReporteNuevo reporte={r} />);
    expect(s).not.toContain("fuera de escala: el máximo graficado");
  });

  it("dice contra qué etapa de la Res. 68 se evaluó el mes", () => {
    const s = html(<ReporteNuevo reporte={coSeptiembre()} />);
    expect(s).toContain("Excedencias · Res. 68/APRA/21 3ra etapa");
    expect(s).toContain("(para este mes, la 3ra etapa)");
  });

  it("sin límite para el contaminante lo dice", () => {
    const s = html(<ReporteNuevo reporte={sinDatos()} />);
    expect(s).toContain("no fija un valor límite");
    expect(s).toContain("SD");
  });
});

describe("eje Y", () => {
  it("paso lindo", () => {
    expect(pasoDelEje(10)).toBe(1);
    expect(pasoDelEje(35)).toBe(5);
    expect(pasoDelEje(3)).toBeCloseTo(0.5);
    expect(pasoDelEje(0)).toBe(1);
  });

  it("respeta la escala de la planilla salvo que los datos la superen", () => {
    const s = (v: number) => [
      { nombre: "x", color: "#000", valores: [v, null] },
    ];
    expect(maximoDelEje(10, s(0.4))).toBe(10);
    expect(maximoDelEje(10, s(23))).toBe(25);
    expect(maximoDelEje(10, s(1), [{ valor: 26, etiqueta: "" }])).toBe(30);
    expect(maximoDelEje(null, s(0))).toBe(1);
  });
});

describe("curvaMonotona", () => {
  // Los puntos de control (y) de cada tramo no pueden salirse del rango de sus
  // dos extremos: una curva que se pasa inventa un pico que no se midió.
  const controles = (d: string) =>
    [...d.matchAll(/C([\d.,\se+-]+)/g)].map((m) =>
      m[1]
        .trim()
        .split(" ")
        .map((p) => Number(p.split(",")[1])),
    );

  it("con menos de tres puntos es una línea recta", () => {
    expect(
      curvaMonotona([
        [0, 0],
        [10, 5],
      ]),
    ).toBe("M0,0 L10,5");
  });

  it("un tramo plano queda plano, sin ondas", () => {
    const d = curvaMonotona([
      [0, 10],
      [10, 10],
      [20, 10],
      [30, 0],
    ]);
    for (const [c1, c2, fin] of controles(d).slice(0, 2)) {
      expect(c1).toBe(10);
      expect(c2).toBe(10);
      expect(fin).toBe(10);
    }
  });

  it("no se pasa de los valores en un pico", () => {
    const p: [number, number][] = [
      [0, 50],
      [10, 10],
      [20, 0],
      [30, 40],
      [40, 45],
    ];
    const d = curvaMonotona(p);
    controles(d).forEach(([c1, c2], i) => {
      const lo = Math.min(p[i][1], p[i + 1][1]);
      const hi = Math.max(p[i][1], p[i + 1][1]);
      expect(c1).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(c1).toBeLessThanOrEqual(hi + 1e-9);
      expect(c2).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(c2).toBeLessThanOrEqual(hi + 1e-9);
    });
  });

  it("una subida brusca no se pasa (limita las pendientes)", () => {
    const p: [number, number][] = [
      [0, 0],
      [10, 0.1],
      [20, 100],
      [30, 100.1],
    ];
    controles(curvaMonotona(p)).forEach(([c1, c2], i) => {
      const hi = Math.max(p[i][1], p[i + 1][1]);
      expect(Math.max(c1, c2)).toBeLessThanOrEqual(hi + 1e-9);
    });
  });
});
