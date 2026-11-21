/**
 * @file Lo que no es dibujo de los gráficos del reporte: los tipos de serie y
 * límite, el eje Y (paso y máximo) y la curva suave. Funciones puras, sin
 * React: las usa el componente de gráfico y los tests.
 */

export type SerieGrafico = {
  nombre: string;
  color: string;
  valores: (number | null)[];
  grosor?: number;
};

export type LimiteGrafico = { valor: number; etiqueta: string; color?: string };

/** Paso "lindo" para el eje: 1, 2, 2,5 o 5 por una potencia de diez. */
export function pasoDelEje(maximo: number, marcas = 10): number {
  if (maximo <= 0) return 1;
  const bruto = maximo / marcas;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pot >= bruto) return m * pot;
  }
  return 10 * pot;
}

/**
 * El máximo del eje Y: el de la planilla (`escala`), salvo que los datos o
 * algún límite lo superen; entonces crece al próximo múltiplo del paso.
 */
export function maximoDelEje(
  escala: number | null,
  series: SerieGrafico[],
  limites: LimiteGrafico[] = [],
): number {
  const datos = series
    .flatMap((s) => s.valores)
    .filter((v): v is number => v !== null);
  const tope = Math.max(0, ...datos, ...limites.map((l) => l.valor * 1.1));
  if (escala !== null && tope <= escala) return escala;
  const paso = pasoDelEje(tope || 1);
  return Math.ceil((tope || 1) / paso) * paso;
}

type Punto = [number, number];

/**
 * Curva por los puntos sin pasarse de ellos (interpolación cúbica monótona,
 * Fritsch–Carlson): suaviza los quiebres sin inventar picos ni valles entre dos
 * valores, que es lo que hace una curva de Bézier común.
 */
export function curvaMonotona(p: Punto[]): string {
  if (p.length < 3) return `M${p.map((q) => q.join(",")).join(" L")}`;
  const n = p.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(p[i + 1][0] - p[i][0]);
    m.push((p[i + 1][1] - p[i][1]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  }
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${p[i][0] + h},${p[i][1] + t[i] * h} ${p[i + 1][0] - h},${p[i + 1][1] - t[i + 1] * h} ${p[i + 1][0]},${p[i + 1][1]}`;
  }
  return d;
}
