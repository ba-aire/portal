// @vitest-environment node
//
// La ruta del índice decide tres cosas antes de bajar a la base: que haya
// sesión, que el índice pedido exista, y que un fallo interno no le cuente al
// cliente nada de la base.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/ica/service", () => ({
  getIca: vi.fn(),
}));

import { GET } from "@/app/api/ica/route";
import { getSession } from "@/lib/auth-session";
import { getIca } from "@/lib/ica/service";

const SESION = {
  userId: "1",
  userName: "Juan",
  email: "juan@example.com",
  role: "VIEWER",
};

const RESPUESTA = {
  indice: "EPA" as const,
  ciudad: null,
  estaciones: [],
  categorias: [],
};

function pedido(query = "") {
  return new NextRequest(`http://localhost/api/ica${query}`);
}

describe("GET /api/ica", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(SESION);
    vi.mocked(getIca).mockResolvedValue(RESPUESTA);
  });

  it("responde 401 sin sesión, sin tocar la base", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await GET(pedido("?indice=EPA"));

    expect(res.status).toBe(401);
    expect(getIca).not.toHaveBeenCalled();
  });

  it.each(["EPA", "EEA"] as const)("acepta el índice %s", async (indice) => {
    const res = await GET(pedido(`?indice=${indice}`));

    expect(res.status).toBe(200);
    expect(getIca).toHaveBeenCalledWith(indice);
    await expect(res.json()).resolves.toEqual(RESPUESTA);
  });

  it("sin parámetro usa EPA", async () => {
    await GET(pedido());

    expect(getIca).toHaveBeenCalledWith("EPA");
  });

  // Caer a un default en silencio haría que el cliente muestre un índice
  // distinto del que cree: las categorías de uno y otro no significan lo mismo.
  it.each(["epa", "OMS", "", "EPA' OR '1'='1"])(
    "responde 400 ante el índice %j, sin tocar la base",
    async (indice) => {
      const res = await GET(pedido(`?indice=${encodeURIComponent(indice)}`));

      expect(res.status).toBe(400);
      expect(getIca).not.toHaveBeenCalled();
    },
  );

  it("un fallo interno da 500 genérico, sin el mensaje de la base", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getIca).mockRejectedValue(
      new Error('relation "gold.v_ica_horario" does not exist'),
    );

    const res = await GET(pedido("?indice=EPA"));

    expect(res.status).toBe(500);
    const cuerpo = await res.json();
    expect(cuerpo).toEqual({ error: "Error interno al obtener el índice" });
    expect(JSON.stringify(cuerpo)).not.toContain("v_ica_horario");
    consola.mockRestore();
  });
});
