/**
 * @file La forma de una tabla del reporte: columnas, filas y celdas, ya en
 * texto. La arman tablas.ts y la dibujan la página del reporte y la vista
 * previa del portal; ninguna de las dos decide el contenido.
 */

export type Columna = { ancho: number; alinear?: "left" | "center" | "right" };

/** Estilo de una celda o fila: lo que cambia de una plantilla a otra. */
export type EstiloCelda = {
  backgroundColor?: string;
  fontWeight?: number;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
};

export type FilaTabla = {
  celdas: string[];
  estilo?: EstiloCelda;
  /** Estilo por celda, en paralelo a `celdas`. */
  estilosCelda?: (EstiloCelda | undefined)[];
  /** Cuántas columnas ocupa cada celda (por defecto 1). */
  spans?: number[];
  /**
   * Cuántas FILAS ocupa cada celda (por defecto 1). En las filas de abajo, su
   * lugar va con CUBIERTA.
   */
  filasQueOcupa?: number[];
  /** Alto de la fila, en pt. */
  alto?: number;
};

/** Marca el lugar de una celda tapada por otra que viene de una fila de arriba. */
export const CUBIERTA = "__cubierta__";

/** Lo que devuelven los armadores de tablas.ts. */
export type TablaArmada = {
  columnas: Columna[];
  filas: FilaTabla[];
  /** Columnas que llevan a su izquierda una línea gruesa. */
  gruesas: number[];
  /** Filas que llevan debajo una línea gruesa (el fin del encabezado). */
  filasGruesas: number[];
  /** Cuántas columnas de la izquierda son de rótulos (por defecto 1). */
  columnasRotulo?: number;
};
