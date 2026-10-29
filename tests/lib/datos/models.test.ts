// @vitest-environment node
//
// Tests del schema que efectivamente usa el service (BoundedQueryParamsSchema),
// no del QueryParamsSchema base que ya cubre datos.test.ts. Acá interesan dos
// cosas que no se ven leyendo el repositorio: los topes de rango y, sobre todo,
// que la validación sea lo único que separa a un parámetro de la URL del SQL
// interpolado. Si un schema se afloja, el repositorio no tiene otra defensa.
import { describe, expect, it } from "vitest";
import { BoundedQueryParamsSchema, MAX_RANGE_DAYS } from "@/lib/datos/models";

const DIA_MS = 24 * 60 * 60 * 1000;
const DESDE = "2026-01-01T00:00:00Z";

/** Fecha a N días de DESDE, en ISO. */
function masDias(dias: number): string {
  return new Date(Date.parse(DESDE) + dias * DIA_MS).toISOString();
}

function parsear(overrides: Record<string, unknown> = {}) {
  return BoundedQueryParamsSchema.safeParse({
    contaminant: "co",
    locations: "centenario",
    startDate: DESDE,
    endDate: masDias(1),
    interval: "hour",
    ...overrides,
  });
}

describe("BoundedQueryParamsSchema", () => {
  it("acepta un pedido válido", () => {
    expect(parsear().success).toBe(true);
  });

  describe("whitelist de estaciones", () => {
    // El repositorio interpola cada location en SQL crudo dos veces: dentro del
    // WHERE y como alias de columna entre comillas dobles. No hay escapado en
    // ningún punto del camino, así que el enum es la única barrera real.
    it("rechaza una estación que no existe", () => {
      expect(parsear({ locations: "rosario" }).success).toBe(false);
    });

    it("rechaza un intento de inyección en el nombre de estación", () => {
      const r = parsear({
        locations: "centenario' OR '1'='1",
      });

      expect(r.success).toBe(false);
    });

    it("rechaza la lista completa si una sola estación es inválida", () => {
      // Sin esto, un pedido mixto colaría el valor malicioso junto a los buenos.
      expect(parsear({ locations: "centenario,rosario" }).success).toBe(false);
    });

    it("acepta varias estaciones válidas separadas por coma", () => {
      const r = parsear({ locations: "centenario, cifa" });

      expect(r.success).toBe(true);
      expect(r.data?.locations).toEqual(["centenario", "cifa"]);
    });
  });

  describe("fechas", () => {
    // startDate y endDate también se interpolan crudas en el WHERE. Que un
    // payload con comilla no pase se apoya en que Date.parse lo rechaza, cosa
    // que no es evidente leyendo el schema: queda fijado acá.
    it.each([
      "2026-01-01T00:00:00Z' OR '1'='1",
      "2026-01-01' UNION SELECT 1--",
      "2026-01-01 00:00:00'",
    ])("rechaza %s como fecha", (payload) => {
      expect(parsear({ startDate: payload }).success).toBe(false);
    });

    it("rechaza un rango invertido", () => {
      const r = parsear({ startDate: masDias(5), endDate: DESDE });

      expect(r.success).toBe(false);
      expect(r.error?.issues[0].path).toEqual(["startDate"]);
    });

    it("acepta que desde y hasta sean iguales", () => {
      expect(parsear({ endDate: DESDE }).success).toBe(true);
    });
  });

  describe("tope de rango por intervalo", () => {
    // Las tablas son minutales: sin techo, un solo request puede pedir años y
    // agotar la cuota de InfluxDB. El tope acompaña la granularidad.
    it.each([
      ["minute", MAX_RANGE_DAYS.minute],
      ["hour", MAX_RANGE_DAYS.hour],
      ["day", MAX_RANGE_DAYS.day],
    ])("acepta exactamente el máximo de %s días", (interval, maximo) => {
      expect(parsear({ interval, endDate: masDias(maximo) }).success).toBe(
        true,
      );
    });

    it.each([
      ["minute", MAX_RANGE_DAYS.minute],
      ["hour", MAX_RANGE_DAYS.hour],
      ["day", MAX_RANGE_DAYS.day],
    ])("rechaza un día más que el máximo de %s", (interval, maximo) => {
      const r = parsear({ interval, endDate: masDias(maximo + 1) });

      expect(r.success).toBe(false);
      expect(r.error?.issues[0].path).toEqual(["endDate"]);
    });

    // El mismo rango puede ser razonable o abusivo según la granularidad: 60
    // días por hora son 1440 puntos, pero por minuto son 86.400.
    it("aplica un techo distinto según el intervalo para el mismo rango", () => {
      const sesentaDias = { endDate: masDias(60) };

      expect(parsear({ ...sesentaDias, interval: "hour" }).success).toBe(true);
      expect(parsear({ ...sesentaDias, interval: "minute" }).success).toBe(
        false,
      );
    });
  });
});
