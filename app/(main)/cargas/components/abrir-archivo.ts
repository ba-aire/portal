import { type Celda, celdaDeExcel, csvACeldas } from "@/lib/carga/parser";

/**
 * Abre un .csv o un .xlsx en el navegador y devuelve su primera hoja como una
 * matriz de celdas. El archivo no viaja al servidor: lo que se manda son las
 * horas ya leídas.
 */
export async function abrirArchivo(archivo: File): Promise<Celda[][]> {
  if (/\.xlsx$/i.test(archivo.name)) {
    // Solo se descarga la librería si hace falta: pesa, y casi todo el portal
    // no la usa.
    const ExcelJS = (await import("exceljs")).default;
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await archivo.arrayBuffer());
    const hoja = libro.worksheets[0];
    if (!hoja) return [];
    const filas: Celda[][] = [];
    hoja.eachRow({ includeEmpty: true }, (fila) => {
      // row.values arranca en el índice 1.
      const valores = Array.isArray(fila.values) ? fila.values.slice(1) : [];
      filas.push(Array.from(valores, celdaDeExcel));
    });
    return filas;
  }
  return csvACeldas(await archivo.text());
}
