// @vitest-environment node
//
// El servicio hace dos cosas con lo que devuelven las vistas: cose los tres
// arreglos paralelos de contaminantes en una lista, y decide el índice de la
// Ciudad. Las dos pueden salir mal sin que nada falle: un arreglo desfasado le
// pone a un contaminante la categoría de otro, y una Ciudad "promediada" o
// elegida por el primer elemento esconde la peor estación.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IcaEstacion } from "@/lib/ica/models";
import type { FilaEstacion } from "@/lib/ica/repository";

vi.mock("@/lib/ica/repository", () => ({
  fetchIcaEstaciones: vi.fn(),
  fetchIcaCategorias: vi.fn(),
  fetchNombresDeParametros: vi.fn(),
}));

import {
  fetchIcaCategorias,
  fetchIcaEstaciones,
  fetchNombresDeParametros,
} from "@/lib/ica/repository";
import { ciudadDe, getIca } from "@/lib/ica/service";

const HORA = new Date("2026-11-10T16:00:00.000Z");

function fila(parcial: Partial<FilaEstacion>): FilaEstacion {
  return {
    station_code: "cordoba",
    station_name: "Córdoba",
    latitude: -34.6,
    longitude: -58.39,
    station_type: "transito",
    station_zone: "Residencial-comercial",
    station_description: "Sobre una avenida",
    ts_hour: HORA,
    categoria: 3,
    categoria_nombre: "Dañina para grupos sensibles",
    color_hex: "#FF7E00",
    valor: 105,
    contaminante_principal: "no2",
    contaminantes: ["no2", "pm25", "co"],
    categorias: [3, 2, 1],
    subindices: [105, 71, 11],
    indice_completo: true,
    ...parcial,
  };
}

const SIN_INDICE: Partial<FilaEstacion> = {
  ts_hour: null,
  categoria: null,
  categoria_nombre: null,
  color_hex: null,
  valor: null,
  contaminante_principal: null,
  contaminantes: null,
  categorias: null,
  subindices: null,
  indice_completo: null,
};

function estacion(parcial: Partial<IcaEstacion>): IcaEstacion {
  return {
    station_code: "x",
    station_name: "X",
    latitude: null,
    longitude: null,
    station_type: null,
    station_zone: null,
    station_description: null,
    ts_hour: null,
    categoria: null,
    categoria_nombre: null,
    color_hex: null,
    valor: null,
    contaminante_principal: null,
    contaminantes: [],
    indice_completo: null,
    ...parcial,
  };
}

describe("getIca", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchIcaCategorias).mockResolvedValue([
      { categoria: 1, nombre: "Buena", color_hex: "#00E400" },
    ]);
    vi.mocked(fetchNombresDeParametros).mockResolvedValue({
      no2: "NO₂",
      pm25: "PM₂.₅",
    });
    vi.mocked(fetchIcaEstaciones).mockResolvedValue([fila({})]);
  });

  it("pide las tres cosas con el índice elegido", async () => {
    const res = await getIca("EEA");

    expect(fetchIcaEstaciones).toHaveBeenCalledWith("EEA");
    expect(fetchIcaCategorias).toHaveBeenCalledWith("EEA");
    expect(res.indice).toBe("EEA");
    expect(res.categorias).toHaveLength(1);
  });

  it("cose los tres arreglos en una lista, en el orden que vienen", async () => {
    const res = await getIca("EPA");

    expect(res.estaciones[0].contaminantes).toEqual([
      { parameter_code: "no2", nombre: "NO₂", categoria: 3, subindice: 105 },
      { parameter_code: "pm25", nombre: "PM₂.₅", categoria: 2, subindice: 71 },
      // dim.parameters no trajo el nombre de "co": se muestra el código, no se cae.
      { parameter_code: "co", nombre: "co", categoria: 1, subindice: 11 },
    ]);
  });

  it("en el índice europeo los subíndices vienen en null y así salen", async () => {
    vi.mocked(fetchIcaEstaciones).mockResolvedValue([
      fila({
        valor: null,
        contaminantes: ["no2"],
        categorias: [3],
        subindices: [null],
      }),
    ]);

    const res = await getIca("EEA");

    expect(res.estaciones[0].valor).toBeNull();
    expect(res.estaciones[0].contaminantes[0].subindice).toBeNull();
  });

  it("la hora sale como ISO", async () => {
    const res = await getIca("EPA");

    expect(res.estaciones[0].ts_hour).toBe("2026-11-10T16:00:00.000Z");
  });

  // El LEFT JOIN deja a la estación sin índice con todo en NULL: tiene que
  // seguir en la respuesta, sin contaminantes y sin romper.
  it("una estación sin índice queda en la lista, vacía", async () => {
    vi.mocked(fetchIcaEstaciones).mockResolvedValue([
      fila({ station_code: "cifa", station_name: "CIFA", ...SIN_INDICE }),
    ]);

    const res = await getIca("EPA");

    expect(res.estaciones[0]).toMatchObject({
      station_code: "cifa",
      ts_hour: null,
      categoria: null,
      contaminantes: [],
    });
    expect(res.ciudad).toBeNull();
  });

  it("la Ciudad sale de las estaciones que se devuelven", async () => {
    vi.mocked(fetchIcaEstaciones).mockResolvedValue([
      fila({
        station_code: "centenario",
        station_name: "Centenario",
        categoria: 1,
        valor: 30,
      }),
      fila({}),
      fila({ station_code: "cifa", station_name: "CIFA", ...SIN_INDICE }),
    ]);

    const res = await getIca("EPA");

    expect(res.ciudad).toMatchObject({
      station_code: "cordoba",
      categoria: 3,
      valor: 105,
      contaminante_principal: "no2",
      n_estaciones: 2,
    });
  });
});

describe("ciudadDe", () => {
  it("es la PEOR estación, no la primera ni un promedio", () => {
    const ciudad = ciudadDe([
      estacion({ station_code: "a", categoria: 1, valor: 20 }),
      estacion({ station_code: "b", categoria: 4, valor: 160 }),
      estacion({ station_code: "c", categoria: 2, valor: 80 }),
    ]);

    expect(ciudad?.station_code).toBe("b");
    expect(ciudad?.valor).toBe(160);
  });

  it("a igual categoría gana el AQI más alto", () => {
    const ciudad = ciudadDe([
      estacion({ station_code: "a", categoria: 2, valor: 60 }),
      estacion({ station_code: "b", categoria: 2, valor: 95 }),
    ]);

    expect(ciudad?.station_code).toBe("b");
  });

  // El índice europeo no tiene número: con la misma categoría no hay con qué
  // desempatar y queda la primera de la lista (orden estable).
  it("sin número, a igual categoría queda la primera", () => {
    const ciudad = ciudadDe([
      estacion({ station_code: "a", categoria: 3 }),
      estacion({ station_code: "b", categoria: 3 }),
    ]);

    expect(ciudad?.station_code).toBe("a");
    expect(ciudad?.valor).toBeNull();
  });

  it("no cuenta las estaciones sin índice", () => {
    const ciudad = ciudadDe([
      estacion({ station_code: "a", categoria: 2, valor: 60 }),
      estacion({ station_code: "b" }),
    ]);

    expect(ciudad?.n_estaciones).toBe(1);
  });

  it("sin ninguna estación con índice no hay Ciudad", () => {
    expect(ciudadDe([estacion({}), estacion({})])).toBeNull();
    expect(ciudadDe([])).toBeNull();
  });
});
