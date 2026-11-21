import { describe, expect, it } from "vitest";
import type { FiltrosType } from "@/app/(main)/descargas/components/filters";
import {
  filtrosAUrl,
  filtrosDesdeUrl,
  filtrosParaBuscar,
} from "@/lib/descargas/filtros-url";

// Lo que muestra /descargas al abrir sin URL (app/(main)/descargas/page.tsx).
const BASE: FiltrosType = {
  integration: "hour",
  location: "centenario",
  startDate: undefined,
  endDate: undefined,
};

const DESDE = "2026-11-18T03:00:00.000Z";
const HASTA = "2026-11-20T03:00:00.000Z";

const leer = (query: string) =>
  filtrosDesdeUrl(new URLSearchParams(query), BASE);

describe("filtrosDesdeUrl (/descargas)", () => {
  it("sin parámetros deja la base y no busca", () => {
    expect(leer("")).toEqual({ filtros: BASE, busqueda: null });
  });

  it("con el juego completo llena los filtros y arma la búsqueda", () => {
    const { filtros, busqueda } = leer(
      `integration=hour&startDate=${DESDE}&endDate=${HASTA}&location=cifa`,
    );
    expect(filtros).toEqual({
      integration: "hour",
      location: "cifa",
      startDate: new Date(DESDE),
      endDate: new Date(HASTA),
    });
    expect(busqueda).toEqual(filtros);
  });

  it("ignora cada valor inválido y deja el de la base", () => {
    const { filtros, busqueda } = leer(
      "integration=mov8h&startDate=2026-13-45&endDate=x&location=cifa,cordoba",
    );
    expect(filtros).toEqual(BASE);
    expect(busqueda).toBeNull();
  });

  it("no completa la estación con la base para buscar", () => {
    const { filtros, busqueda } = leer(
      `integration=hour&startDate=${DESDE}&endDate=${HASTA}`,
    );
    expect(filtros.location).toBe("centenario");
    expect(busqueda).toBeNull();
  });

  it("no busca si 'desde' es posterior a 'hasta'", () => {
    expect(
      leer(`integration=hour&startDate=${HASTA}&endDate=${DESDE}&location=cifa`)
        .busqueda,
    ).toBeNull();
  });

  it("los minutales buscan con un solo día y la franja de la URL", () => {
    const { busqueda } = leer(
      `integration=minute&startDate=${DESDE}&location=cordoba&startHour=10&endHour=11`,
    );
    expect(busqueda).toEqual({
      integration: "minute",
      location: "cordoba",
      startDate: new Date(DESDE),
      endDate: new Date(DESDE),
      startHour: 10,
      endHour: 11,
    });
  });

  it("los minutales descartan una franja al revés", () => {
    const { filtros, busqueda } = leer(
      `integration=minute&startDate=${DESDE}&location=cordoba&startHour=11&endHour=10`,
    );
    expect(filtros.startHour).toBeUndefined();
    expect(filtros.endHour).toBeUndefined();
    // La franja inválida no frena la búsqueda: va el día entero.
    expect(busqueda).toMatchObject({ startHour: 0, endHour: 24 });
  });
});

describe("filtrosAUrl (/descargas)", () => {
  it("ida y vuelta: lo que escribe la búsqueda se vuelve a leer igual", () => {
    for (const filtros of [
      {
        integration: "hour",
        location: "catalinas",
        startDate: new Date(DESDE),
        endDate: new Date(HASTA),
      },
      {
        integration: "minute",
        location: "cifa",
        startDate: new Date(DESDE),
        endDate: undefined,
        startHour: 0,
        endHour: 6,
      },
    ] satisfies FiltrosType[]) {
      const enviado = filtrosParaBuscar(filtros);
      expect(leer(filtrosAUrl(enviado).toString()).busqueda).toEqual(enviado);
    }
  });

  it("no escribe fechas vacías", () => {
    expect([...filtrosAUrl(BASE).keys()]).toEqual(["integration", "location"]);
  });
});
