// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  colorDeTexto,
  franjaHoraria,
  tipoDeEstacion,
} from "@/lib/ica/presentacion";

describe("colorDeTexto", () => {
  // Los colores de las categorías vienen de airedb. El amarillo de "Moderada"
  // es el AQI más frecuente: con texto blanco no se lee.
  it.each([
    ["#00E400", "verde EPA"],
    ["#FFFF00", "amarillo EPA"],
    ["#FF7E00", "naranja EPA"],
    ["#50F0E6", "turquesa EEA"],
    ["#F0E641", "amarillo EEA"],
  ])("texto oscuro sobre %s (%s)", (fondo) => {
    expect(colorDeTexto(fondo)).toBe("#111827");
  });

  it.each([
    ["#FF0000", "rojo EPA"],
    ["#FF5050", "rojo EEA"],
    ["#8F3F97", "violeta EPA"],
    ["#7E0023", "bordó EPA"],
    ["#960032", "bordó EEA"],
    ["#7D2181", "violeta EEA"],
  ])("texto blanco sobre %s (%s)", (fondo) => {
    expect(colorDeTexto(fondo)).toBe("#FFFFFF");
  });

  it("sin color o con uno mal formado, texto oscuro", () => {
    expect(colorDeTexto(null)).toBe("#111827");
    expect(colorDeTexto("rojo")).toBe("#111827");
  });
});

describe("franjaHoraria", () => {
  // gold rotula la hora por su inicio, en UTC. 16:00 UTC son las 13:00 de
  // Buenos Aires, y el índice de esa fila cubre hasta las 14:00.
  it("muestra la hora completa, en hora de Buenos Aires", () => {
    expect(franjaHoraria("2026-11-10T16:00:00.000Z")).toBe("13:00 a 14:00");
  });

  it("cruza la medianoche", () => {
    expect(franjaHoraria("2026-11-11T02:00:00.000Z")).toBe("23:00 a 00:00");
  });

  it("sin hora o con una inválida, null", () => {
    expect(franjaHoraria(null)).toBeNull();
    expect(franjaHoraria("no es una fecha")).toBeNull();
  });
});

describe("tipoDeEstacion", () => {
  it("traduce los tres tipos de dim.stations", () => {
    expect(tipoDeEstacion("transito")).toBe("Tránsito");
    expect(tipoDeEstacion("industrial")).toBe("Industrial");
    expect(tipoDeEstacion("fondo")).toBe("Fondo urbano");
  });

  it("un tipo que no conoce lo muestra tal cual; sin tipo, null", () => {
    expect(tipoDeEstacion("rural")).toBe("rural");
    expect(tipoDeEstacion(null)).toBeNull();
  });
});
