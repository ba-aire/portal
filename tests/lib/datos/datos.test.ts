import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

// Mock de la capa repository: evita importar @/db/influx y pegarle a InfluxDB.
vi.mock("@/lib/datos/repository", () => ({
  fetchDatosPorContaminante: vi.fn(),
}));

// Mock del módulo de filters (componente "use client"): models.ts solo necesita
// los arrays de opciones para construir los schemas. Reflejamos los valores reales.
vi.mock("@/app/(main)/datos/contaminante/components/filters", () => ({
  contaminantesOptions: [
    { label: "CO", value: "co" },
    { label: "NO2 Solo", value: "no2" },
    { label: "NOx Totales", value: "nox" },
    { label: "PM10", value: "pm10" },
    { label: "PM2.5", value: "pm25" },
    { label: "PM10 y 2.5", value: "pm1025" },
    { label: "O3", value: "o3" },
    { label: "SO2", value: "so2" },
  ],
  promedioOptions: [
    { label: "Minutos", value: "minute" },
    { label: "Horas", value: "hour" },
    { label: "Días", value: "day" },
  ],
}));

import { filtrosSchema, QueryParamsSchema } from "@/lib/datos/models";
import { fetchDatosPorContaminante } from "@/lib/datos/repository";
import { datosService } from "@/lib/datos/service";

const validRawParams = {
  contaminant: "co",
  locations: "centenario",
  startDate: "2025-07-29T00:00:00Z",
  endDate: "2025-07-30T00:00:00Z",
  interval: "hour",
};

describe("DatosService.getDatosPorContaminante", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valida params, llama al repo y devuelve el resultado con count", async () => {
    vi.mocked(fetchDatosPorContaminante).mockResolvedValue({
      data: [
        { time: "2025-07-29T00:00:00.000Z", centenario: 1.23 },
        { time: "2025-07-29T01:00:00.000Z", centenario: 2.34 },
      ],
      meta: {
        contaminant: "co",
        locations: ["centenario"],
        startDate: validRawParams.startDate,
        endDate: validRawParams.endDate,
        interval: "hour",
      },
    });

    const result = await datosService.getDatosPorContaminante(validRawParams);

    // El schema transforma "centenario" (string) en ["centenario"] antes de llegar al repo
    expect(fetchDatosPorContaminante).toHaveBeenCalledWith(
      expect.objectContaining({
        contaminant: "co",
        locations: ["centenario"],
        interval: "hour",
      }),
    );

    expect(result.data).toHaveLength(2);
    expect(result.meta.count).toBe(2);
    expect(result.meta.contaminant).toBe("co");
    expect(result.meta.interval).toBe("hour");
  });

  it("aplica defaults cuando faltan params y el repo recibe el array por defecto", async () => {
    vi.mocked(fetchDatosPorContaminante).mockResolvedValue({
      data: [],
      meta: {
        contaminant: "co",
        locations: ["centenario", "cordoba", "catalinas", "cifa"],
        startDate: "2025-07-29T00:00:00Z",
        endDate: "2025-07-30T00:00:00Z",
        interval: "hour",
      },
    });

    const result = await datosService.getDatosPorContaminante({});

    expect(fetchDatosPorContaminante).toHaveBeenCalledWith(
      expect.objectContaining({
        contaminant: "co",
        locations: ["centenario", "cordoba", "catalinas", "cifa"],
        interval: "hour",
      }),
    );
    expect(result.meta.count).toBe(0);
  });

  // El servicio propaga el ZodError con su tipo intacto en vez de reempaquetarlo
  // en un Error genérico: es lo que permite a la route devolver 400 con detalle
  // de validación y 500 genérico para todo lo demás, sin filtrar el mensaje del
  // driver de InfluxDB al cliente.
  it("propaga un ZodError y no llama al repo si los params son inválidos", async () => {
    await expect(
      datosService.getDatosPorContaminante({
        ...validRawParams,
        startDate: "no-es-fecha",
      }),
    ).rejects.toThrow(ZodError);

    expect(fetchDatosPorContaminante).not.toHaveBeenCalled();
  });

  it("expone los contaminantes, intervalos y ubicaciones disponibles", () => {
    expect(datosService.getAvailableContaminants()).toEqual([
      "co",
      "no2",
      "no",
      "nox",
      "pm10",
      "pm25",
      "o3",
      "so2",
    ]);
    expect(datosService.getAvailableIntervals()).toEqual([
      "minute",
      "hour",
      "day",
    ]);
    expect(datosService.getAvailableLocations()).toEqual([
      "centenario",
      "cordoba",
      "catalinas",
      "cifa",
    ]);
  });
});

describe("QueryParamsSchema (datos)", () => {
  it("aplica defaults cuando el objeto está vacío", () => {
    const parsed = QueryParamsSchema.parse({});
    expect(parsed.contaminant).toBe("co");
    expect(parsed.interval).toBe("hour");
    expect(parsed.locations).toEqual([
      "centenario",
      "cordoba",
      "catalinas",
      "cifa",
    ]);
  });

  it("transforma 'locations' CSV en un array recortando espacios", () => {
    const parsed = QueryParamsSchema.parse({
      locations: "centenario, cordoba ,catalinas",
    });
    expect(parsed.locations).toEqual(["centenario", "cordoba", "catalinas"]);
  });

  it("rechaza fechas inválidas", () => {
    expect(QueryParamsSchema.safeParse({ startDate: "nope" }).success).toBe(
      false,
    );
    expect(QueryParamsSchema.safeParse({ endDate: "nope" }).success).toBe(
      false,
    );
  });

  it("rechaza contaminant e interval fuera del enum", () => {
    expect(QueryParamsSchema.safeParse({ contaminant: "xx" }).success).toBe(
      false,
    );
    expect(QueryParamsSchema.safeParse({ interval: "year" }).success).toBe(
      false,
    );
  });
});

describe("filtrosSchema (datos)", () => {
  const base = {
    metrica: "co",
    interval: "hour",
    locations: "centenario",
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

  it("rechaza una métrica inválida", () => {
    expect(filtrosSchema.safeParse({ ...base, metrica: "xx" }).success).toBe(
      false,
    );
  });

  it("rechaza cuando no se selecciona ninguna estación", () => {
    expect(
      filtrosSchema.safeParse({ ...base, locations: "  ,  " }).success,
    ).toBe(false);
  });
});
