// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  colorDeTexto,
  etiquetaDeHora,
  franjaHoraria,
  HORAS_ATRAS,
  haceCuanto,
  horaEnCurso,
  horasDelSelector,
  horasDistintas,
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

describe("horaEnCurso", () => {
  it("trunca al inicio de la hora", () => {
    expect(
      horaEnCurso(new Date("2026-11-21T16:42:13.500Z")).toISOString(),
    ).toBe("2026-11-21T16:00:00.000Z");
  });

  it("una hora en punto queda igual", () => {
    expect(
      horaEnCurso(new Date("2026-11-21T16:00:00.000Z")).toISOString(),
    ).toBe("2026-11-21T16:00:00.000Z");
  });
});

describe("horasDelSelector", () => {
  const AHORA = new Date("2026-11-21T16:42:00.000Z");

  it("ofrece las HORAS_ATRAS horas completas, de la más vieja a la más nueva", () => {
    const horas = horasDelSelector(AHORA);

    expect(horas).toHaveLength(HORAS_ATRAS);
    expect(horas[0]).toBe("2026-11-19T16:00:00.000Z");
    expect(horas.at(-1)).toBe("2026-11-21T15:00:00.000Z");
  });

  // gold nunca tiene la hora en curso: ofrecerla daría siempre "sin índice".
  it("no incluye la hora en curso", () => {
    expect(horasDelSelector(AHORA)).not.toContain("2026-11-21T16:00:00.000Z");
  });

  it("van de a una hora", () => {
    const horas = horasDelSelector(AHORA).map((h) => new Date(h).getTime());
    for (let i = 1; i < horas.length; i++) {
      expect(horas[i] - horas[i - 1]).toBe(60 * 60 * 1000);
    }
  });
});

describe("haceCuanto", () => {
  const AHORA = new Date("2026-11-21T16:42:00.000Z");

  it("en singular para la hora anterior a la en curso", () => {
    expect(haceCuanto("2026-11-21T15:00:00.000Z", AHORA)).toBe("Hace 1 hora");
  });

  it("en plural para las demás", () => {
    expect(haceCuanto("2026-11-20T07:00:00.000Z", AHORA)).toBe("Hace 33 horas");
  });
});

describe("etiquetaDeHora", () => {
  // 16:00 UTC del sábado 21 son las 13:00 de Buenos Aires.
  it("el día y la franja, en hora de Buenos Aires", () => {
    expect(etiquetaDeHora("2026-11-21T16:00:00.000Z")).toBe(
      "sáb 21/11, 13:00 a 14:00",
    );
  });

  // 02:00 UTC del domingo 22 todavía es el sábado 21 en Buenos Aires.
  it("toma el día local, no el de UTC", () => {
    expect(etiquetaDeHora("2026-11-22T02:00:00.000Z")).toBe(
      "sáb 21/11, 23:00 a 00:00",
    );
  });

  it("sin hora o con una inválida, null", () => {
    expect(etiquetaDeHora(null)).toBeNull();
    expect(etiquetaDeHora("no es una fecha")).toBeNull();
  });
});

describe("horasDistintas", () => {
  it("las horas de las estaciones con índice, sin repetir, de la más nueva a la más vieja", () => {
    expect(
      horasDistintas([
        { ts_hour: "2026-11-21T14:00:00.000Z" },
        { ts_hour: null },
        { ts_hour: "2026-11-21T15:00:00.000Z" },
        { ts_hour: "2026-11-21T14:00:00.000Z" },
      ]),
    ).toEqual(["2026-11-21T15:00:00.000Z", "2026-11-21T14:00:00.000Z"]);
  });

  it("sin estaciones con índice, vacío", () => {
    expect(horasDistintas([{ ts_hour: null }])).toEqual([]);
  });
});
