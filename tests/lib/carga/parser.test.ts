// El lector del archivo de carga: de la planilla ancha del área técnica a la
// lista de horas. Lo que no puede pasar es que un archivo mal leído entre a
// medias o corrido una hora: todo lo que no se entiende lo rechaza entero.
import { describe, expect, it } from "vitest";
import {
  celdaDeExcel,
  csvACeldas,
  formatearHoraArgentina,
  leerPlanilla,
} from "@/lib/carga/parser";

const CODIGOS = ["co", "no", "no2", "nox", "pm10", "pm25"];

// El formato real: las primeras filas del archivo de NOx de Córdoba.
const EJEMPLO = [
  ["FECHA", "HORA", "NO", "NO2", "NOX"],
  ["2026-09-11", "05:00", 5.26, 13.84, 19.1],
  ["2026-09-11", "06:00", 12.93, 20.79, 33.72],
];

function errores(celdas: unknown[][], marca: "inicio" | "fin" = "inicio") {
  const r = leerPlanilla(celdas as never, CODIGOS, marca);
  return r.ok ? [] : r.errores;
}

describe("leerPlanilla", () => {
  it("lee el formato del área técnica: una hora por fila y parámetro", () => {
    const r = leerPlanilla(EJEMPLO, CODIGOS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parametros).toEqual(["no", "no2", "nox"]);
    expect(r.filas).toBe(2);
    expect(r.horas).toHaveLength(6);
    // 05:00 de Buenos Aires es 08:00 UTC, y es el INICIO de la hora.
    expect(r.horas[0]).toEqual({
      parameter_code: "no",
      ts_hour: "2026-09-11T08:00:00.000Z",
      value: 5.26,
    });
  });

  it("con la hora al final, el inicio es una hora antes", () => {
    const r = leerPlanilla(EJEMPLO, CODIGOS, "fin");
    expect(r.ok && r.horas[0].ts_hour).toBe("2026-09-11T07:00:00.000Z");
  });

  it("«24:00» vale solo con la hora al final: es la última del día", () => {
    const celdas = [
      ["fecha", "hora", "co"],
      ["2026-09-11", "24:00", 1],
    ];
    const r = leerPlanilla(celdas, CODIGOS, "fin");
    // De 23:00 a 24:00 local = inicio 02:00 UTC del día siguiente.
    expect(r.ok && r.horas[0].ts_hour).toBe("2026-09-12T02:00:00.000Z");
    expect(errores(celdas)[0]).toContain("24:00");
  });

  it("«s/d» y las celdas vacías son horas sin dato: no se cargan", () => {
    const r = leerPlanilla(
      [
        ["FECHA", "HORA", "NO", "NO2"],
        ["2026-09-11", "05:00", "s/d", 13.84],
        ["2026-09-11", "06:00", null, "S/D"],
        ["2026-09-11", "07:00", "", 1],
      ],
      CODIGOS,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.horas.map((h) => h.value)).toEqual([13.84, 1]);
    expect(r.sinDato).toBe(4);
  });

  it("acepta coma decimal, fecha dd/mm/aaaa, y hora sin minutos o con segundos", () => {
    const r = leerPlanilla(
      [
        ["Fecha", "Hora", "PM2.5"],
        ["11/09/2026", "5", "12,5"],
        ["11/09/2026", "06:00:00", "-0.3"],
      ],
      CODIGOS,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parametros).toEqual(["pm25"]);
    expect(r.horas).toEqual([
      {
        parameter_code: "pm25",
        ts_hour: "2026-09-11T08:00:00.000Z",
        value: 12.5,
      },
      {
        parameter_code: "pm25",
        ts_hour: "2026-09-11T09:00:00.000Z",
        value: -0.3,
      },
    ]);
  });

  it("entiende las fechas y horas como las entrega Excel", () => {
    const r = leerPlanilla(
      [
        ["FECHA", "HORA", "CO"],
        // Fecha como Date a medianoche UTC; hora como Date de 1899.
        [
          new Date(Date.UTC(2026, 8, 11)),
          new Date(Date.UTC(1899, 11, 30, 5)),
          1,
        ],
        // Hora como fracción del día (6/24) y como entero.
        [new Date(Date.UTC(2026, 8, 11)), 0.25, 2],
        [new Date(Date.UTC(2026, 8, 11)), 7, 3],
      ],
      CODIGOS,
    );
    expect(r.ok && r.horas.map((h) => h.ts_hour)).toEqual([
      "2026-09-11T08:00:00.000Z",
      "2026-09-11T09:00:00.000Z",
      "2026-09-11T10:00:00.000Z",
    ]);
  });

  it("ignora las filas vacías y las columnas sin encabezado", () => {
    const r = leerPlanilla(
      [
        ["FECHA", "HORA", "CO", ""],
        [null, null, null, null],
        ["2026-09-11", "05:00", 1, "nota"],
        ["", "", "", ""],
      ],
      CODIGOS,
    );
    expect(r.ok && r.horas).toHaveLength(1);
  });

  it.each([
    [[["FECHA", "HORA", "CO"]], "El archivo no tiene filas de datos"],
    [[], "El archivo no tiene filas de datos"],
    [
      [
        ["DIA", "HORA", "CO"],
        ["2026-09-11", "05:00", 1],
      ],
      "Faltan las columnas FECHA y HORA en la primera fila",
    ],
    [
      [
        ["FECHA", "HORA", "H2S"],
        ["2026-09-11", "05:00", 1],
      ],
      "Columna desconocida: «H2S»",
    ],
    [
      [
        ["FECHA", "HORA", "CO", "co"],
        ["2026-09-11", "05:00", 1, 2],
      ],
      "La columna «co» está repetida",
    ],
    [
      [
        ["FECHA", "HORA"],
        ["2026-09-11", "05:00"],
      ],
      "El archivo no tiene ninguna columna de parámetro",
    ],
    [
      [
        ["FECHA", "HORA", "CO"],
        ["2026-02-30", "05:00", 1],
      ],
      "Fila 2: fecha inválida («2026-02-30»)",
    ],
    [
      [
        ["FECHA", "HORA", "CO"],
        ["31/02/2026", "05:00", 1],
      ],
      "Fila 2: fecha inválida («31/02/2026»)",
    ],
    [
      [
        ["FECHA", "HORA", "CO"],
        ["2026-09-11", "05:30", 1],
      ],
      "Fila 2: hora inválida («05:30»): tiene que ser una hora en punto",
    ],
    [
      [
        ["FECHA", "HORA", "CO"],
        ["2026-09-11", "25:00", 1],
      ],
      "Fila 2: hora inválida («25:00»): tiene que ser una hora en punto",
    ],
    [
      [
        ["FECHA", "HORA", "CO"],
        ["2026-09-11", "05:00", 1],
        ["2026-09-11", "05:00", 2],
      ],
      "Fila 3: la fecha y hora están repetidas",
    ],
    [
      [
        ["FECHA", "HORA", "CO"],
        ["2026-09-11", "05:00", "1.2.3"],
      ],
      "Fila 2, co: «1.2.3» no es un número ni «s/d»",
    ],
    [
      [
        ["FECHA", "HORA", "CO"],
        ["2026-09-11", "05:00", "s/d"],
      ],
      "El archivo no trae ningún valor para cargar",
    ],
  ])("rechaza el archivo entero: %#", (celdas, mensaje) => {
    expect(errores(celdas)).toEqual([mensaje]);
  });

  it("rechaza lo que Excel entrega y no es una fecha, una hora o un número", () => {
    const invalida = new Date(Number.NaN);
    expect(
      errores([
        ["FECHA", "HORA", "CO"],
        [invalida, "05:00", 1],
        ["2026-09-11", invalida, 1],
        ["2026-09-11", new Date(Date.UTC(1899, 11, 30, 5, 30)), 1],
        ["2026-09-11", 0.26, 1],
        ["2026-09-11", "07:00", new Date()],
        ["2026-09-11", "08:00", Number.POSITIVE_INFINITY],
      ]),
    ).toHaveLength(6);
  });

  it("la fila que se informa es la del archivo, contando las vacías", () => {
    expect(
      errores([
        ["FECHA", "HORA", "CO"],
        [null, null, null],
        ["2026-09-11", "x", 1],
      ]),
    ).toEqual(["Fila 3: hora inválida («x»): tiene que ser una hora en punto"]);
  });

  it("corta la lista de errores: un archivo roto no devuelve mil renglones", () => {
    const celdas: unknown[][] = [["FECHA", "HORA", "CO"]];
    for (let i = 0; i < 50; i++) celdas.push(["mal", "05:00", 1]);
    expect(errores(celdas)).toHaveLength(20);
  });
});

describe("csvACeldas", () => {
  it("separa por coma", () => {
    expect(csvACeldas("FECHA,HORA,NO\n2026-09-11,05:00,5.26\n")).toEqual([
      ["FECHA", "HORA", "NO"],
      ["2026-09-11", "05:00", "5.26"],
    ]);
  });

  // Excel en castellano: punto y coma de separador, coma decimal.
  it("separa por punto y coma si es lo que usa el encabezado", () => {
    expect(
      csvACeldas("﻿FECHA;HORA;NO\r\n11/09/2026;05:00;5,26\r\n\r\n"),
    ).toEqual([
      ["FECHA", "HORA", "NO"],
      ["11/09/2026", "05:00", "5,26"],
    ]);
  });

  it("saca las comillas", () => {
    expect(csvACeldas('"FECHA","HORA"')).toEqual([["FECHA", "HORA"]]);
  });

  it("un archivo vacío no tiene filas", () => {
    expect(csvACeldas("\n\n")).toEqual([]);
  });
});

describe("celdaDeExcel", () => {
  const fecha = new Date();
  it.each([
    [null, null],
    [undefined, null],
    ["s/d", "s/d"],
    [1.5, 1.5],
    [fecha, fecha],
    [{ formula: "A1+1", result: 2 }, 2],
    [{ richText: [{ text: "s" }, { text: "/d" }] }, "s/d"],
    [{ text: "05:00", hyperlink: "x" }, "05:00"],
    [{ error: "#N/A" }, "#N/A"],
    [true, "true"],
    [{}, "[object Object]"],
  ])("%j", (valor, esperado) => {
    expect(celdaDeExcel(valor)).toEqual(esperado);
  });
});

describe("formatearHoraArgentina", () => {
  // No depende del huso del navegador: es la hora del archivo.
  it("muestra la hora de Buenos Aires", () => {
    const s = formatearHoraArgentina("2026-09-11T08:00:00.000Z");
    expect(s).toContain("11/09/2026");
    expect(s).toContain("05:00");
  });
});
