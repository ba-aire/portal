import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

// Mock de la capa repository: evita importar @/db/influx y pegarle a InfluxDB.
vi.mock("@/lib/descargas/repository", () => ({
  fetchDatosPorEstacion: vi.fn(),
}));

// Mock del módulo de filters: models.ts solo necesita los arrays de opciones.
vi.mock("@/app/(main)/descargas/components/filters", () => ({
  promedioOptions: [
    { label: "Minutales", value: "minute" },
    { label: "Horarios", value: "hour" },
  ],
  locationOptions: [
    { label: "Centenario", value: "centenario" },
    { label: "La Boca", value: "catalinas" },
    { label: "Cordoba", value: "cordoba" },
    { label: "Cifa", value: "cifa" },
  ],
}));

import {
  DataPointSchema,
  filtrosSchema,
  QueryParamsSchema,
} from "@/lib/descargas/models";
import { fetchDatosPorEstacion } from "@/lib/descargas/repository";
import { datosService } from "@/lib/descargas/service";

const validRawParams = {
  location: "centenario",
  startDate: "2025-07-29T00:00:00Z",
  endDate: "2025-07-30T00:00:00Z",
  integration: "hour",
};

describe("DatosService.getDatosPorEstacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valida params, llama al repo y devuelve el resultado con count y meta", async () => {
    vi.mocked(fetchDatosPorEstacion).mockResolvedValue({
      data: [
        { time: "2025-07-29T00:00:00.000Z", co: 1.234, co_k_status: 60 },
        { time: "2025-07-29T01:00:00.000Z", co: 2.345, co_k_status: 58 },
      ],
      meta: {
        location: "centenario",
        startDate: validRawParams.startDate,
        endDate: validRawParams.endDate,
        integration: "hour",
      },
    });

    const result = await datosService.getDatosPorEstacion(validRawParams);

    expect(fetchDatosPorEstacion).toHaveBeenCalledWith({
      location: "centenario",
      startDate: validRawParams.startDate,
      endDate: validRawParams.endDate,
      integration: "hour",
    });

    expect(result.data).toHaveLength(2);
    expect(result.meta.count).toBe(2);
    expect(result.meta.location).toBe("centenario");
    expect(result.meta.integration).toBe("hour");
  });

  // El servicio propaga el ZodError con su tipo intacto en vez de reempaquetarlo
  // en un Error genérico: es lo que permite a la route devolver 400 con detalle
  // de validación y 500 genérico para todo lo demás, sin filtrar el mensaje del
  // driver de InfluxDB al cliente.
  it.each([
    ["location vacío", { ...validRawParams, location: "" }],
    ["location fuera del enum", { ...validRawParams, location: "otra-cosa" }],
    ["integration vacío", { ...validRawParams, integration: "" }],
    ["fecha inválida", { ...validRawParams, startDate: "no-es-fecha" }],
    [
      "startDate posterior a endDate",
      {
        ...validRawParams,
        startDate: "2025-07-30T00:00:00Z",
        endDate: "2025-07-29T00:00:00Z",
      },
    ],
    [
      "rango que excede el tope de la integración",
      {
        ...validRawParams,
        integration: "minute",
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2025-01-01T00:00:00Z",
      },
    ],
  ])("propaga un ZodError con %s", async (_caso, params) => {
    await expect(datosService.getDatosPorEstacion(params)).rejects.toThrow(
      ZodError,
    );
    expect(fetchDatosPorEstacion).not.toHaveBeenCalled();
  });
});

describe("DataPointSchema (descargas)", () => {
  it("convierte time numérico (ms) a string ISO", () => {
    const ms = Date.UTC(2025, 6, 29, 0, 0, 0); // 2025-07-29T00:00:00.000Z
    const parsed = DataPointSchema.parse({ time: ms });
    expect(parsed.time).toBe(new Date(ms).toISOString());
  });

  it("convierte time Date a string ISO", () => {
    const date = new Date("2025-07-29T00:00:00.000Z");
    const parsed = DataPointSchema.parse({ time: date });
    expect(parsed.time).toBe("2025-07-29T00:00:00.000Z");
  });

  it("convierte time null a string vacío", () => {
    expect(DataPointSchema.parse({ time: null }).time).toBe("");
  });

  it("convierte un valor bigint a number en el catchall", () => {
    // BigInt(...) en vez del literal 1234n: el target TS del proyecto es ES2017
    // y los literales BigInt requieren ES2020. Sigue siendo un bigint real en runtime.
    const parsed = DataPointSchema.parse({
      time: "2025-07-29T00:00:00.000Z",
      co_mean: BigInt(1234),
    });
    expect(parsed.co_mean).toBe(1234);
    expect(typeof parsed.co_mean).toBe("number");
  });

  it("preserva null y los status 'k'/'i' en el catchall", () => {
    const parsed = DataPointSchema.parse({
      time: "2025-07-29T00:00:00.000Z",
      co_mean: null,
      co_status: "k",
      pm10_status: "i",
    });
    expect(parsed.co_mean).toBeNull();
    expect(parsed.co_status).toBe("k");
    expect(parsed.pm10_status).toBe("i");
  });
});

describe("QueryParamsSchema (descargas)", () => {
  it("aplica defaults cuando el objeto está vacío", () => {
    const parsed = QueryParamsSchema.parse({});
    expect(parsed.location).toBe("centenario");
    expect(parsed.integration).toBe("hour");
  });

  it("rechaza una location fuera del enum", () => {
    expect(QueryParamsSchema.safeParse({ location: "marte" }).success).toBe(
      false,
    );
  });

  it("rechaza fechas inválidas", () => {
    expect(QueryParamsSchema.safeParse({ startDate: "nope" }).success).toBe(
      false,
    );
  });
});

describe("filtrosSchema (descargas)", () => {
  const base = {
    integration: "hour",
    location: "centenario",
    startDate: new Date("2025-07-29T00:00:00Z"),
    endDate: new Date("2025-07-30T00:00:00Z"),
  };

  it("acepta filtros válidos", () => {
    expect(filtrosSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza cuando startDate es posterior a endDate", () => {
    const result = filtrosSchema.safeParse({
      ...base,
      startDate: new Date("2025-07-31T00:00:00Z"),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "startDate")).toBe(
        true,
      );
    }
  });

  it("rechaza una integración inválida", () => {
    expect(
      filtrosSchema.safeParse({ ...base, integration: "year" }).success,
    ).toBe(false);
  });

  it("rechaza una estación inválida", () => {
    expect(
      filtrosSchema.safeParse({ ...base, location: "marte" }).success,
    ).toBe(false);
  });
});
