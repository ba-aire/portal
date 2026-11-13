// @vitest-environment node
//
// La sesión de airedb es read-only por defecto. La única escritura del portal
// (las revisiones manuales) abre su propia transacción READ WRITE: tiene que
// confirmar si todo sale bien, volver atrás si no, y devolver la conexión al
// pool en los dos casos.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cliente } = vi.hoisted(() => ({
  cliente: {
    query: vi.fn(),
    release: vi.fn(),
  },
}));

vi.mock("pg", () => ({
  Pool: vi.fn(function Pool() {
    return { connect: async () => cliente, query: vi.fn() };
  }),
}));

import { transaccionDeEscritura } from "@/db/airedb";

const sentencias = () => cliente.query.mock.calls.map((c) => c[0]);

beforeEach(() => {
  vi.stubEnv("AIREDB_URL", "postgres://portal@localhost/airedb");
  cliente.query.mockReset().mockResolvedValue({ rows: [{ id: 1 }] });
  cliente.release.mockReset();
});

describe("transaccionDeEscritura", () => {
  it("abre READ WRITE, corre, confirma y libera", async () => {
    const r = await transaccionDeEscritura((consulta) =>
      consulta("SELECT revision.anular($1, $2, $3)", [1, "m", "u"]),
    );
    expect(r).toEqual([{ id: 1 }]);
    expect(sentencias()).toEqual([
      "BEGIN READ WRITE",
      "SELECT revision.anular($1, $2, $3)",
      "COMMIT",
    ]);
    expect(cliente.query.mock.calls[1][1]).toEqual([1, "m", "u"]);
    expect(cliente.release).toHaveBeenCalledTimes(1);
  });

  it("sin parámetros manda un arreglo vacío", async () => {
    await transaccionDeEscritura((consulta) => consulta("SELECT 1"));
    expect(cliente.query.mock.calls[1][1]).toEqual([]);
  });

  it("ante un error: ROLLBACK, libera y relanza", async () => {
    const error = new Error("22023");
    await expect(
      transaccionDeEscritura(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(sentencias()).toEqual(["BEGIN READ WRITE", "ROLLBACK"]);
    expect(cliente.release).toHaveBeenCalledTimes(1);
  });

  // Si la conexión se cayó, el ROLLBACK también falla: el error que importa es
  // el original.
  it("si el ROLLBACK falla, relanza el error original", async () => {
    cliente.query.mockImplementation(async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("conexión cerrada");
      return { rows: [] };
    });
    const error = new Error("original");
    await expect(
      transaccionDeEscritura(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(cliente.release).toHaveBeenCalledTimes(1);
  });
});
