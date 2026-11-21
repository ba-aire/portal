import { describe, expect, it } from "vitest";
import type { FiltrosType } from "@/app/(main)/datos/contaminante/components/filters";
import {
  filtrosAUrl,
  filtrosDesdeUrl,
  filtrosParaBuscar,
} from "@/lib/datos/filtros-url";

// Lo que muestra /datos al abrir sin URL (app/(main)/datos/contaminante/page.tsx).
const BASE: FiltrosType = {
  metrica: "co",
  interval: "hour",
  startDate: undefined,
  endDate: undefined,
  locations: "",
};

const DESDE = "2026-11-18T03:00:00.000Z";
const HASTA = "2026-11-20T03:00:00.000Z";

const leer = (query: string) =>
  filtrosDesdeUrl(new URLSearchParams(query), BASE);

describe("filtrosDesdeUrl (/datos)", () => {
  it("sin parámetros deja la base y no busca", () => {
    expect(leer("")).toEqual({ filtros: BASE, busqueda: null });
  });

  it("con el juego completo llena los filtros y arma la búsqueda", () => {
    const { filtros, busqueda } = leer(
      `metrica=pm10&interval=mov8h&startDate=${DESDE}&endDate=${HASTA}&locations=cifa,centenario`,
    );
    expect(filtros).toEqual({
      metrica: "pm10",
      interval: "mov8h",
      startDate: new Date(DESDE),
      endDate: new Date(HASTA),
      locations: "cifa,centenario",
    });
    expect(busqueda).toEqual(filtros);
  });

  it("ignora cada valor inválido y deja el de la base", () => {
    const { filtros, busqueda } = leer(
      "metrica=h2s&interval=day&startDate=ayer&endDate=&locations=palermo",
    );
    expect(filtros).toEqual(BASE);
    expect(busqueda).toBeNull();
  });

  it("no acepta la métrica 'no' (existe en la API, no en el selector)", () => {
    expect(leer("metrica=no").filtros.metrica).toBe("co");
  });

  it("de las estaciones se queda con las válidas, sin repetir", () => {
    expect(
      leer("locations= cordoba ,palermo,cordoba,catalinas").filtros.locations,
    ).toBe("cordoba,catalinas");
  });

  it("completa lo que puede pero no busca si falta algo", () => {
    const { filtros, busqueda } = leer(
      `metrica=o3&interval=hour&startDate=${DESDE}&locations=cifa`,
    );
    expect(filtros).toMatchObject({
      metrica: "o3",
      startDate: new Date(DESDE),
      endDate: undefined,
      locations: "cifa",
    });
    expect(busqueda).toBeNull();
  });

  it("no completa la métrica con la base para buscar", () => {
    expect(
      leer(`interval=hour&startDate=${DESDE}&endDate=${HASTA}&locations=cifa`)
        .busqueda,
    ).toBeNull();
  });

  it("no busca si 'desde' es posterior a 'hasta'", () => {
    const { filtros, busqueda } = leer(
      `metrica=co&interval=hour&startDate=${HASTA}&endDate=${DESDE}&locations=cifa`,
    );
    expect(filtros.startDate).toEqual(new Date(HASTA));
    expect(busqueda).toBeNull();
  });

  describe("minutales", () => {
    it("buscan con un solo día y la franja de la URL", () => {
      const { busqueda } = leer(
        `metrica=co&interval=minute&startDate=${DESDE}&locations=cifa&startHour=8&endHour=18`,
      );
      expect(busqueda).toEqual({
        metrica: "co",
        interval: "minute",
        startDate: new Date(DESDE),
        endDate: new Date(DESDE),
        locations: "cifa",
        startHour: 8,
        endHour: 18,
      });
    });

    it("sin franja buscan el día entero", () => {
      const { busqueda } = leer(
        `metrica=co&interval=minute&startDate=${DESDE}&locations=cifa`,
      );
      expect(busqueda).toMatchObject({ startHour: 0, endHour: 24 });
    });

    it("descartan una franja al revés o fuera de rango", () => {
      for (const franja of [
        "startHour=18&endHour=8",
        "startHour=24",
        "endHour=0",
        "startHour=-1",
        "startHour=7.5",
        "startHour=abc",
      ]) {
        const { filtros } = leer(`interval=minute&${franja}`);
        expect(filtros.startHour, franja).toBeUndefined();
        expect(filtros.endHour, franja).toBeUndefined();
      }
    });

    it("aceptan una sola punta de la franja si cierra con el defecto", () => {
      expect(leer("startHour=6").filtros).toMatchObject({ startHour: 6 });
      expect(leer("endHour=12").filtros).toMatchObject({ endHour: 12 });
      expect(leer("startHour=6").filtros.endHour).toBeUndefined();
    });
  });
});

describe("filtrosAUrl (/datos)", () => {
  it("ida y vuelta: lo que escribe la búsqueda se vuelve a leer igual", () => {
    for (const filtros of [
      {
        metrica: "pm1025",
        interval: "hour",
        startDate: new Date(DESDE),
        endDate: new Date(HASTA),
        locations: "centenario,cordoba",
      },
      {
        metrica: "nox",
        interval: "minute",
        startDate: new Date(DESDE),
        endDate: undefined,
        locations: "catalinas",
        startHour: 6,
        endHour: 9,
      },
    ] satisfies FiltrosType[]) {
      const enviado = filtrosParaBuscar(filtros);
      expect(leer(filtrosAUrl(enviado).toString()).busqueda).toEqual(enviado);
    }
  });

  it("no escribe estaciones ni fechas vacías", () => {
    const params = filtrosAUrl(BASE);
    expect([...params.keys()]).toEqual(["metrica", "interval"]);
  });
});
