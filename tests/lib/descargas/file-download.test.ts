// Este módulo corre en el browser: arma un Blob y dispara la descarga con un
// <a download>. Se corre bajo jsdom (el entorno por defecto del proyecto) y se
// intercepta URL.createObjectURL para quedarse con el Blob y leer lo que
// realmente se le entrega al usuario, en vez de afirmar sobre internals.
import { Blob as BlobDeNode } from "node:buffer";
import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataRow } from "@/hooks/useFetchDescargas";
import {
  downloadAsCSV,
  downloadAsExcel,
  generateFilename,
} from "@/lib/descargas/file-download";

let blobDescargado: Blob | null = null;
let nombreDescargado: string | null = null;

beforeEach(() => {
  blobDescargado = null;
  nombreDescargado = null;

  // El Blob de jsdom no implementa text() ni arrayBuffer(), así que no hay
  // forma de leer lo que se descargó. El de Node sí, y para este módulo son
  // intercambiables: sólo se lo usa como contenedor de bytes.
  vi.stubGlobal("Blob", BlobDeNode);

  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn((blob: Blob) => {
      blobDescargado = blob;
      return "blob:test";
    }),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });

  // jsdom no navega, pero el click sobre un <a href="blob:"> emite un warning
  // ruidoso: se intercepta y de paso se captura el nombre propuesto.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    nombreDescargado = this.getAttribute("download");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Contenido de texto del archivo entregado. */
async function textoDescargado(): Promise<string> {
  if (!blobDescargado) throw new Error("No se generó ninguna descarga");
  return await blobDescargado.text();
}

/** Filas del CSV entregado. */
async function filasCSV(): Promise<string[]> {
  return (await textoDescargado()).split("\n");
}

/** Hoja del archivo entregado; falla con un mensaje claro si no existe. */
function hojaDe(workbook: ExcelJS.Workbook, nombre: string): ExcelJS.Worksheet {
  const hoja = workbook.getWorksheet(nombre);
  if (!hoja) throw new Error(`El archivo no tiene la hoja "${nombre}"`);
  return hoja;
}

/** Número de la fila de encabezados: la que empieza con "Fecha y Hora". */
function filaEncabezados(hoja: ExcelJS.Worksheet): number {
  for (let i = 1; i <= hoja.rowCount; i++) {
    if (hoja.getRow(i).getCell(1).value === "Fecha y Hora") return i;
  }
  throw new Error("La hoja no tiene fila de encabezados");
}

/** Encabezados no vacíos de una hoja. */
function encabezadosDe(hoja: ExcelJS.Worksheet): string[] {
  return (hoja.getRow(filaEncabezados(hoja)).values as string[]).filter(
    Boolean,
  );
}

/** Texto completo de las notas que están arriba de los encabezados. */
function notasDe(hoja: ExcelJS.Worksheet): string {
  const textos: string[] = [];
  for (let i = 1; i < filaEncabezados(hoja); i++) {
    hoja.getRow(i).eachCell((celda) => {
      if (typeof celda.value === "string") textos.push(celda.value);
    });
  }
  return textos.join(" ");
}

/** Celda de la primera fila de datos bajo el encabezado dado. */
function celdaDe(hoja: ExcelJS.Worksheet, encabezado: string): ExcelJS.Cell {
  const fila = filaEncabezados(hoja);
  const indice = (hoja.getRow(fila).values as string[]).findIndex(
    (h) => h?.toLowerCase() === encabezado.toLowerCase(),
  );
  if (indice === -1) {
    throw new Error(`La hoja no tiene la columna "${encabezado}"`);
  }
  return hoja.getRow(fila + 1).getCell(indice);
}

/** Color de fondo de una celda, si tiene un relleno sólido. */
function colorDeFondo(celda: ExcelJS.Cell): string | undefined {
  const fill = celda.fill;
  return fill && fill.type === "pattern" && fill.pattern === "solid"
    ? fill.fgColor?.argb
    : undefined;
}

/** Workbook releído desde el archivo entregado. */
async function excelDescargado(): Promise<ExcelJS.Workbook> {
  if (!blobDescargado) throw new Error("No se generó ninguna descarga");
  const workbook = new ExcelJS.Workbook();
  // ExcelJS delega en jszip, que no acepta un ArrayBuffer pelado: necesita un
  // Buffer. El cast es porque exceljs trae su propia declaración de Buffer, no
  // genérica, incompatible con la de @types/node actual (Buffer<ArrayBuffer>).
  type BufferDeExcelJS = Parameters<ExcelJS.Xlsx["load"]>[0];
  const datos = Buffer.from(await blobDescargado.arrayBuffer());
  await workbook.xlsx.load(datos as unknown as BufferDeExcelJS);
  return workbook;
}

const FILA: DataRow = {
  time: "2026-01-15T14:30:00Z",
  co: 1.23456,
  no2: 9.87654,
  temp: 20.55,
  co_k_status: 58,
};

describe("generateFilename", () => {
  const BASE = {
    location: "centenario" as const,
    integration: "hour" as const,
    startDate: new Date("2026-01-01T00:00:00Z"),
    endDate: new Date("2026-01-31T00:00:00Z"),
  };

  it("arma el nombre con estación, integración y rango", () => {
    expect(generateFilename(BASE, "csv")).toBe(
      "descargas_centenario_horarios_2026-01-01_2026-01-31.csv",
    );
  });

  // El archivo lo abre una persona: tiene que decir "La Boca", que es como se
  // conoce la estación, y no "catalinas", que es el id interno de la tabla.
  it("usa la etiqueta legible de la estación y no el identificador", () => {
    const nombre = generateFilename({ ...BASE, location: "catalinas" }, "csv");

    expect(nombre).toContain("la_boca");
    expect(nombre).not.toContain("catalinas");
  });

  it("reemplaza los espacios de la etiqueta por guiones bajos", () => {
    expect(generateFilename({ ...BASE, location: "catalinas" }, "csv")).toBe(
      "descargas_la_boca_horarios_2026-01-01_2026-01-31.csv",
    );
  });

  it("usa sólo la fecha de inicio si no hay fecha de fin", () => {
    expect(generateFilename({ ...BASE, endDate: undefined }, "csv")).toBe(
      "descargas_centenario_horarios_2026-01-01.csv",
    );
  });

  it("omite el rango cuando no hay fechas", () => {
    expect(
      generateFilename(
        { ...BASE, startDate: undefined, endDate: undefined },
        "csv",
      ),
    ).toBe("descargas_centenario_horarios.csv");
  });

  it("respeta la extensión pedida", () => {
    expect(generateFilename(BASE, "xlsx")).toMatch(/\.xlsx$/);
  });
});

describe("downloadAsCSV", () => {
  it("rechaza generar un archivo vacío", () => {
    // Un CSV con sólo encabezados parece un período sin mediciones; es mejor
    // avisar que no hay datos que entregar un archivo engañoso.
    expect(() => downloadAsCSV([], "x.csv")).toThrow("No hay datos");
  });

  it("entrega el archivo con el nombre pedido", () => {
    downloadAsCSV([FILA], "mi-descarga.csv", "hour");

    expect(nombreDescargado).toBe("mi-descarga.csv");
  });

  it("encabeza con la fecha y capitaliza el resto de las columnas", async () => {
    downloadAsCSV([FILA], "x.csv", "hour");

    const [encabezado] = await filasCSV();
    expect(encabezado.startsWith("Fecha y Hora,")).toBe(true);
    expect(encabezado).toContain("Co");
    expect(encabezado).toContain("No2");
  });

  // Las columnas salen de TABLE_CONFIG, no de las claves presentes en los
  // datos: así dos descargas de estaciones distintas tienen el mismo formato y
  // se pueden apilar sin realinear nada.
  it("incluye todas las columnas configuradas aunque falten en los datos", async () => {
    downloadAsCSV([{ time: FILA.time, co: 1 }], "x.csv", "hour");

    const [encabezado, primera] = await filasCSV();
    expect(encabezado).toContain("O3");
    expect(encabezado).toContain("Lluvia");
    expect(primera).toContain("s/d");
  });

  // El encabezado es lo que lee la persona que abre el archivo: la estación se
  // nombra "La Boca", no por su identificador interno. El mapeo está duplicado
  // en la ruta de CSV y en la de Excel, así que se verifica en las dos.
  it("nombra a catalinas como La Boca en el encabezado", async () => {
    downloadAsCSV([{ time: FILA.time, catalinas: 5 }], "x.csv", "hour");

    const [encabezado] = await filasCSV();
    expect(encabezado).toContain("La Boca");
    expect(encabezado).not.toContain("Catalinas");
  });

  it("marca los faltantes como s/d en vez de dejarlos vacíos", async () => {
    downloadAsCSV([{ time: FILA.time, co: 1, o3: null as never }], "x.csv");

    const [, fila] = await filasCSV();
    expect(fila.split(",")).toContain("s/d");
  });

  it("escribe los números con tres decimales", async () => {
    downloadAsCSV([FILA], "x.csv", "hour");

    const [, fila] = await filasCSV();
    expect(fila).toContain("1.235");
  });

  it("pasa los estados a mayúscula", async () => {
    downloadAsCSV([{ time: FILA.time, co: 1, co_status: "k" }], "x.csv");

    const [, fila] = await filasCSV();
    expect(fila.split(",")).toContain("K");
  });

  describe("escapado RFC 4180", () => {
    // Sin esto, un valor con coma parte la fila y corre todas las columnas
    // siguientes: el archivo abre pero los datos quedan mal alineados.
    it("entrecomilla los valores que contienen comas", async () => {
      downloadAsCSV(
        [{ time: FILA.time, co: 1, extra: "uno,dos" }],
        "x.csv",
        "hour",
      );

      expect(await textoDescargado()).toContain('"uno,dos"');
    });

    it("duplica las comillas internas", async () => {
      downloadAsCSV(
        [{ time: FILA.time, co: 1, extra: 'dice "hola"' }],
        "x.csv",
        "hour",
      );

      expect(await textoDescargado()).toContain('"dice ""hola"""');
    });

    it("entrecomilla los valores con salto de línea", async () => {
      downloadAsCSV(
        [{ time: FILA.time, co: 1, extra: "primera\nsegunda" }],
        "x.csv",
        "hour",
      );

      expect(await textoDescargado()).toContain('"primera\nsegunda"');
    });
  });

  describe("columnas de estado según la integración", () => {
    it("usa _k_status en la integración horaria", async () => {
      downloadAsCSV([FILA], "x.csv", "hour");

      expect((await filasCSV())[0]).toContain("Co_k_status");
    });

    // El CSV es una sola tabla, así que lleva las dos series lado a lado: la
    // validada con el nombre base y la cruda con el sufijo _raw, junto con los
    // status observados en cada hora.
    it("incluye la serie cruda y los status observados en la integración horaria", async () => {
      downloadAsCSV([FILA], "x.csv", "hour");

      const [encabezado] = await filasCSV();
      expect(encabezado).toContain("Co_raw");
      expect(encabezado).toContain("Co_status");
    });

    it("usa _status en la integración minutal", async () => {
      // Sin co_k_status en los datos: getOrderedColumns arrastra al final
      // cualquier campo presente que no esté en TABLE_CONFIG, y ese arrastre
      // enmascararía lo que se quiere verificar acá.
      downloadAsCSV([{ time: FILA.time, co: 1 }], "x.csv", "minute");

      const encabezado = (await filasCSV())[0];
      expect(encabezado).toContain("Co_status");
      expect(encabezado).not.toContain("Co_k_status");
    });

    // Si el llamador no dice qué integración pidió, se deduce de los datos:
    // una columna "_status" suelta sólo aparece en la consulta minutal.
    it("infiere la integración a partir de los datos cuando no se la pasan", async () => {
      downloadAsCSV([{ time: FILA.time, co: 1, co_status: "k" }], "x.csv");

      expect((await filasCSV())[0]).toContain("Co_status");
    });
  });
});

describe("downloadAsExcel", () => {
  it("rechaza generar un archivo vacío", async () => {
    await expect(downloadAsExcel([], "x.xlsx")).rejects.toThrow("No hay datos");
  });

  it("genera las hojas crudos y validados", async () => {
    await downloadAsExcel([FILA], "x.xlsx", "hour");

    const workbook = await excelDescargado();
    expect(workbook.worksheets.map((h) => h.name)).toEqual([
      "crudos",
      "validados",
    ]);
  });

  // "validados" es la hoja que se comparte hacia afuera: lleva sólo las
  // mediciones, sin las columnas de control interno de la red.
  it("excluye las columnas de estado de la hoja validados", async () => {
    await downloadAsExcel([FILA], "x.xlsx", "hour");

    const encabezados = encabezadosDe(
      hojaDe(await excelDescargado(), "validados"),
    );

    expect(encabezados.some((h) => h.toLowerCase().includes("status"))).toBe(
      false,
    );
  });

  it("conserva las columnas de estado en la hoja crudos", async () => {
    await downloadAsExcel([FILA], "x.xlsx", "hour");

    const encabezados = encabezadosDe(
      hojaDe(await excelDescargado(), "crudos"),
    );

    expect(encabezados.some((h) => h.toLowerCase().includes("status"))).toBe(
      true,
    );
  });

  // A diferencia del CSV —que usa tres decimales para todo—, el Excel respeta
  // la precisión de cada instrumento: el CO se informa con tres decimales y la
  // temperatura con uno, porque el sensor no mide más que eso. En la hoja de
  // crudos la columna se llama como la métrica pero el dato sale de la serie
  // _raw, así que la precisión tiene que heredarse del nombre base.
  it.each([
    ["co", 1.23456, 1.235],
    ["no2", 9.87654, 9.88],
    ["temp", 20.55, 20.6],
  ])(
    "escribe %s con la precisión de su instrumento",
    async (columna, crudo, esperado) => {
      await downloadAsExcel(
        [{ time: FILA.time, [`${columna}_raw`]: crudo }],
        "x.xlsx",
        "hour",
      );

      const hoja = hojaDe(await excelDescargado(), "crudos");
      expect(celdaDe(hoja, columna).value).toBe(esperado);
    },
  );

  // El motivo del arreglo del promedio horario: la hoja crudos lleva el
  // promedio de todos los minutos (serie _raw, mostrada con el nombre base) y
  // validados el promedio construido sólo con los minutos de status k.
  it("separa el promedio crudo del validado en su hoja correspondiente", async () => {
    await downloadAsExcel(
      [{ time: FILA.time, co: 1.111, co_raw: 2.222, co_k_status: 58 }],
      "x.xlsx",
      "hour",
    );

    const workbook = await excelDescargado();
    expect(celdaDe(hojaDe(workbook, "crudos"), "co").value).toBe(2.222);
    expect(celdaDe(hojaDe(workbook, "validados"), "co").value).toBe(1.111);
  });

  describe("marca de respaldo insuficiente", () => {
    // 45 minutos k = 75% de la hora: por debajo, el promedio validado se
    // entrega igual pero resaltado, para que quien analiza sepa que la hora
    // está armada con pocos minutos.
    it("resalta el promedio de una hora con menos de 45 minutos válidos", async () => {
      await downloadAsExcel(
        [{ time: FILA.time, co: 1.5, co_k_status: 44 }],
        "x.xlsx",
        "hour",
      );

      const hoja = hojaDe(await excelDescargado(), "validados");
      expect(colorDeFondo(celdaDe(hoja, "co"))).toBe("FFFFEB9C");
    });

    it("no resalta una hora con respaldo suficiente", async () => {
      await downloadAsExcel(
        [{ time: FILA.time, co: 1.5, co_k_status: 45 }],
        "x.xlsx",
        "hour",
      );

      const hoja = hojaDe(await excelDescargado(), "validados");
      expect(colorDeFondo(celdaDe(hoja, "co"))).toBeUndefined();
    });

    // En crudos el promedio es el de todos los minutos: no depende del respaldo
    // k, así que resaltarlo sería engañoso. La marca va sobre el conteo.
    it("no resalta el promedio crudo aunque falten minutos válidos", async () => {
      await downloadAsExcel(
        [{ time: FILA.time, co: 1.5, co_raw: 2, co_k_status: 10 }],
        "x.xlsx",
        "hour",
      );

      const hoja = hojaDe(await excelDescargado(), "crudos");
      expect(colorDeFondo(celdaDe(hoja, "co"))).toBeUndefined();
    });

    // El conteo es lo que se mira en crudos para saber si la hora se sostiene:
    // marcarlo evita tener que comparar 60 columnas contra el umbral a ojo.
    it("resalta en crudos el conteo de minutos k por debajo de 45", async () => {
      await downloadAsExcel(
        [{ time: FILA.time, co_raw: 2, co_k_status: 44 }],
        "x.xlsx",
        "hour",
      );

      const hoja = hojaDe(await excelDescargado(), "crudos");
      expect(colorDeFondo(celdaDe(hoja, "co_k_status"))).toBe("FFFFEB9C");
    });

    it("no resalta el conteo cuando la hora tiene respaldo suficiente", async () => {
      await downloadAsExcel(
        [{ time: FILA.time, co_raw: 2, co_k_status: 45 }],
        "x.xlsx",
        "hour",
      );

      const hoja = hojaDe(await excelDescargado(), "crudos");
      expect(colorDeFondo(celdaDe(hoja, "co_k_status"))).toBeUndefined();
    });
  });

  describe("notas aclaratorias", () => {
    // El archivo lo abre gente ajena a la red: sin la leyenda, los códigos de
    // status (K, I, Z, S...) y el resaltado amarillo son inentendibles.
    it("explica el significado de cada status en la hoja crudos", async () => {
      await downloadAsExcel([FILA], "x.xlsx", "hour");

      const notas = notasDe(hojaDe(await excelDescargado(), "crudos"));
      expect(notas).toContain("K = OK");
      expect(notas).toContain("M = Mantenimiento");
      expect(notas).toContain("Z = Zero cal");
    });

    // La leyenda completa de status vive en crudos: en validados no hay
    // columnas de status, así que repetirla ahí es sólo ruido.
    it("no repite la leyenda de status en validados", async () => {
      await downloadAsExcel([FILA], "x.xlsx", "hour");

      const notas = notasDe(hojaDe(await excelDescargado(), "validados"));
      expect(notas).not.toContain("Zero cal");
    });

    it("explica en validados qué significa el resaltado amarillo", async () => {
      await downloadAsExcel([FILA], "x.xlsx", "hour");

      const notas = notasDe(hojaDe(await excelDescargado(), "validados"));
      expect(notas).toContain("amarillo");
      expect(notas).toContain("45 minutos válidos");
    });

    // La nota arranca en la primera columna y lleva el fondo amarillo que
    // explica: la línea entera funciona como muestra del color.
    it("pinta de amarillo la nota del resaltado", async () => {
      await downloadAsExcel([FILA], "x.xlsx", "hour");

      const hoja = hojaDe(await excelDescargado(), "validados");
      let filaNota = 0;
      for (let i = 1; i < filaEncabezados(hoja); i++) {
        const valor = hoja.getRow(i).getCell(1).value;
        if (typeof valor === "string" && valor.includes("amarillo")) {
          filaNota = i;
        }
      }
      expect(filaNota).toBeGreaterThan(0);
      expect(colorDeFondo(hoja.getRow(filaNota).getCell(1))).toBe("FFFFEB9C");
    });

    it("explica en crudos qué significa el resaltado del conteo", async () => {
      await downloadAsExcel([FILA], "x.xlsx", "hour");

      const notas = notasDe(hojaDe(await excelDescargado(), "crudos"));
      expect(notas).toContain("amarillo");
      expect(notas).toContain("45 minutos en status K");
    });

    it("aclara qué serie contiene cada hoja", async () => {
      await downloadAsExcel([FILA], "x.xlsx", "hour");

      const workbook = await excelDescargado();
      expect(notasDe(hojaDe(workbook, "crudos"))).toContain(
        "sin importar su status",
      );
      expect(notasDe(hojaDe(workbook, "validados"))).toContain("status K");
    });
  });

  describe("rango horario en la columna de fecha", () => {
    // La fila "14:00" contiene los minutos de 14:01 a 15:00: mostrar el rango
    // completo evita leerla como una medición puntual de las 14:00.
    it("muestra la hora como rango en la integración horaria", async () => {
      await downloadAsExcel([FILA], "x.xlsx", "hour");

      const hoja = hojaDe(await excelDescargado(), "crudos");
      const celdaFecha = hoja.getRow(filaEncabezados(hoja) + 1).getCell(1);
      expect(celdaFecha.value).toBe("15/01/2026, 11:30 a 12:30 hs");
    });

    it("mantiene la hora puntual en la integración minutal", async () => {
      await downloadAsExcel(
        [{ time: FILA.time, co: 1, co_status: "k" }],
        "x.xlsx",
        "minute",
      );

      const hoja = hojaDe(await excelDescargado(), "crudos");
      const celdaFecha = hoja.getRow(filaEncabezados(hoja) + 1).getCell(1);
      expect(celdaFecha.value).toBe("15/01/2026, 11:30");
    });
  });

  describe("legibilidad de la grilla", () => {
    // Las descargas abarcan varios días: el borde medio al cambiar de día es
    // lo que permite recorrer la planilla sin perderse entre las horas.
    it("separa el cambio de día con un borde superior medio", async () => {
      await downloadAsExcel(
        [
          { time: "2026-01-15T20:30:00Z", co: 1 },
          { time: "2026-01-16T20:30:00Z", co: 2 },
        ],
        "x.xlsx",
        "hour",
      );

      const hoja = hojaDe(await excelDescargado(), "validados");
      const fila = filaEncabezados(hoja);
      expect(hoja.getRow(fila + 1).getCell(1).border?.top?.style).not.toBe(
        "medium",
      );
      expect(hoja.getRow(fila + 2).getCell(1).border?.top?.style).toBe(
        "medium",
      );
    });

    // Columnas angostas con números de distinto largo: alineados a la izquierda
    // (el default de Excel para el texto) la grilla se lee en zigzag.
    it.each(["crudos", "validados"])(
      "centra encabezados y datos en la hoja %s",
      async (nombre) => {
        await downloadAsExcel([FILA], "x.xlsx", "hour");

        const hoja = hojaDe(await excelDescargado(), nombre);
        const encabezado = hoja.getRow(filaEncabezados(hoja)).getCell(1);
        const dato = celdaDe(hoja, "co");

        for (const celda of [encabezado, dato]) {
          expect(celda.alignment?.horizontal).toBe("center");
          expect(celda.alignment?.vertical).toBe("middle");
        }
      },
    );

    // Las notas son texto corrido fusionado a lo ancho: centrarlas las dejaría
    // flotando lejos del borde y sin punto de arranque para la lectura.
    it("deja las notas alineadas a la izquierda", async () => {
      await downloadAsExcel([FILA], "x.xlsx", "hour");

      const hoja = hojaDe(await excelDescargado(), "crudos");
      expect(hoja.getRow(1).getCell(1).alignment?.horizontal).not.toBe(
        "center",
      );
    });

    it("congela las notas y los encabezados", async () => {
      await downloadAsExcel([FILA], "x.xlsx", "hour");

      const hoja = hojaDe(await excelDescargado(), "crudos");
      // WorksheetView es una unión discriminada por state: xSplit sólo existe
      // en las variantes frozen/split, así que hay que narrowear antes.
      const vista = hoja.views[0];
      if (vista?.state !== "frozen") {
        throw new Error("La hoja no tiene panel congelado");
      }
      expect(vista.ySplit).toBe(filaEncabezados(hoja));
      // Sin panel vertical: su línea divisoria cruzaría las notas de arriba
      expect(vista.xSplit ?? 0).toBe(0);
    });
  });

  it("nombra a catalinas como La Boca en el encabezado", async () => {
    await downloadAsExcel(
      [{ time: FILA.time, catalinas: 5 }],
      "x.xlsx",
      "hour",
    );

    const encabezados = encabezadosDe(
      hojaDe(await excelDescargado(), "crudos"),
    );

    expect(encabezados).toContain("La Boca");
    expect(encabezados).not.toContain("Catalinas");
  });

  it("entrega el archivo con el nombre pedido", async () => {
    await downloadAsExcel([FILA], "reporte.xlsx", "hour");

    expect(nombreDescargado).toBe("reporte.xlsx");
  });
});
