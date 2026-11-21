// @vitest-environment node
//
// Las tablas que comparten las dos plantillas. La de CO se compara contra el
// PDF publicado de septiembre de 2026 (hoja 1): mismos textos, celda por celda.
import { describe, expect, it } from "vitest";
import {
  gruposDelPerfil,
  tablaDias,
  tablaEstadisticos,
  tablaPerfil,
} from "@/lib/reportes/tablas";
import { vista } from "@/lib/reportes/vista";
import { reporteCO, reporteNOx } from "./fixture";

const C = {
  rotulo: "a",
  promedio24: "b",
  promedio8: "c",
  promedio1: "d",
  perfil: "e",
};

describe("tabla de días", () => {
  it("CO: el día 1 y el 17 como en la planilla", () => {
    const { filas } = tablaDias(vista(reporteCO()), 535, C);
    const datos = filas.slice(2); // dos filas de encabezado con un parámetro
    expect(datos).toHaveLength(30);
    expect(datos[0].celdas).toEqual([
      "1",
      "0,5",
      "0,4",
      "0,6",
      "0,6",
      "0,8",
      "0,3",
    ]);
    expect(datos[16].celdas).toEqual([
      "17",
      "0,5",
      "0,3",
      "0,3",
      "0,8",
      "1,7",
      "0,2",
    ]);
  });

  it("CO: una columna de rótulos y seis de valores que suman el ancho", () => {
    const { columnas } = tablaDias(vista(reporteCO()), 535, C);
    expect(columnas).toHaveLength(7);
    expect(columnas.reduce((s, c) => s + c.ancho, 0)).toBeCloseTo(535);
  });

  it("NOx: tres filas de encabezado, la tercera con los parámetros sin subíndices", () => {
    const { filas, columnas } = tablaDias(vista(reporteNOx()), 535, C);
    expect(columnas).toHaveLength(1 + 18);
    expect(filas[2].celdas.slice(1, 4)).toEqual(["NO", "NO2", "NOX"]);
    expect(filas.length).toBe(3 + 30);
  });

  it("NOx: SD, DND y <LD", () => {
    const { filas } = tablaDias(vista(reporteNOx()), 535, C);
    const dia = (n: number) => filas[2 + n].celdas;
    expect(dia(3)[1]).toBe("SD");
    expect(dia(4)[1]).toBe("DND"); // promedio diario inválido
    expect(dia(4)[4]).toBe("10"); // pero el bloque 0-8 es válido
    expect(dia(4)[10]).toBe("DND"); // bloque 16-24 inválido
    // Mínimo horario del NO (columna 16) por debajo de 0,4 ppb.
    expect(dia(11)[16]).toBe("<0,4");
    expect(dia(11)[17]).toBe("2");
  });
});

describe("tabla de estadísticos", () => {
  it("CO: las filas de la planilla", () => {
    const { filas } = tablaEstadisticos(vista(reporteCO()), 535, C);
    const fila = (r: string) =>
      filas.find((f) => f.celdas[0] === r)?.celdas.slice(1);
    expect(fila("Cantidad de Datos")).toEqual(["30", "30", "30", "30", "716"]);
    expect(fila("Mínimo")).toEqual(["0,2", "0,1", "0,2", "0,2", "0,1"]);
    expect(fila("Percentil 95")).toEqual(["0,5", "0,4", "0,5", "0,7", "0,6"]);
    expect(fila("Percentil 98")).toEqual(["0,5", "0,4", "0,5", "0,8", "0,8"]);
    expect(fila("Máximo")).toEqual(["0,6", "0,4", "0,6", "0,8", "1,7"]);
    expect(fila("Media Aritmética")).toEqual([
      "0,3",
      "0,3",
      "0,3",
      "0,4",
      "0,3",
    ]);
    expect(fila("Desvío Estándar")).toEqual([
      "0,1",
      "0,1",
      "0,1",
      "0,2",
      "0,2",
    ]);
    expect(fila("Mediana")).toEqual(["0,3", "0,3", "0,3", "0,4", "0,3"]);
  });

  it("NOx: <LD solo en los valores de una hora, y una serie vacía", () => {
    const { filas } = tablaEstadisticos(vista(reporteNOx()), 535, C);
    const fila = (r: string) =>
      filas.find((f) => f.celdas[0] === r)?.celdas.slice(1) ?? [];
    // Columnas: 24h(3) 0-8(3) 8-16(3) 16-24(3) 1h(3); el mínimo es 0,3.
    expect(fila("Mínimo")[0]).toBe("0"); // un promedio diario no lleva <LD
    expect(fila("Mínimo")[12]).toBe("<0,4"); // una hora sí
    expect(fila("Media Aritmética")[12]).toBe("21"); // la media no
    expect(fila("Cantidad de Datos")[9]).toBe("0"); // NO, bloque 16-24, vacío
    expect(fila("Mínimo")[9]).toBe("SD");
  });
});

describe("tabla del perfil horario", () => {
  it("CO: los nueve grupos y la primera fila en 23:00", () => {
    const v = vista(reporteCO());
    const { filas } = tablaPerfil(v, 535, C);
    expect(gruposDelPerfil(v)).toHaveLength(9);
    expect(filas[0].celdas).toEqual([
      "HORARIO",
      "Mensual",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Dom y Feri",
      "Lun a Vier",
    ]);
    expect(filas[1].celdas[0]).toBe("23:00 a 00:00");
    expect(filas[1].celdas[1]).toBe("0,4"); // 0,2 + 23/100
    expect(filas[24].celdas[0]).toBe("22:00 a 23:00");
  });

  it("NOx: cuatro grupos por tres parámetros", () => {
    const v = vista(reporteNOx());
    const { filas, columnas } = tablaPerfil(v, 535, C);
    expect(gruposDelPerfil(v)).toEqual([
      "mensual",
      "sabado",
      "domingo_feriado",
      "lunes_a_viernes",
    ]);
    expect(columnas).toHaveLength(1 + 12);
    expect(filas[1].celdas.slice(1, 4)).toEqual(["NO", "NO2", "NOX"]);
  });
});

describe("vista", () => {
  it("el límite de un gráfico solo si un único parámetro lo tiene", () => {
    const co = vista(reporteCO());
    expect(co.limiteDe("8h")?.limite).toBe(9);
    expect(co.limiteDe("24h")).toBeUndefined();
    const nox = vista(reporteNOx());
    expect(nox.limiteDe("1h")?.parameter_code).toBe("no2");
  });

  it("un parámetro sin ficha usa su código", () => {
    const r = reporteCO();
    r.ficha = [];
    const v = vista(r);
    expect(v.nombre("co")).toBe("CO");
    expect(v.ld("co")).toBeNull();
  });
});
