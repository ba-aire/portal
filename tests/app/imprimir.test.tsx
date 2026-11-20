// @vitest-environment node
//
// La página que imprime Gotenberg queda fuera de las rutas protegidas del proxy:
// la autorización está en la página. Entra quien trae un token para ESE reporte
// o una sesión del portal; el resto va a /login sin tocar la base.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));
vi.mock("@/lib/auth-session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/reportes/service", () => ({ getReporteMensual: vi.fn() }));
vi.mock("@/lib/reportes/impresion", () => ({ tokenValido: vi.fn() }));

import Pagina from "@/app/imprimir/reporte-mensual/page";
import { getSession } from "@/lib/auth-session";
import { ReporteClasico } from "@/lib/reportes/html/clasico";
import { ReporteNuevo } from "@/lib/reportes/html/nuevo";
import { tokenValido } from "@/lib/reportes/impresion";
import { getReporteMensual } from "@/lib/reportes/service";
import { reporteCO } from "../lib/reportes/fixture";

const BASE = {
  estacion: "centenario",
  contaminante: "co",
  mes: "2026-09",
};
const abrir = (q: Record<string, string | string[]>) =>
  Pagina({ searchParams: Promise.resolve(q) });

describe("/imprimir/reporte-mensual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(tokenValido).mockResolvedValue(false);
    vi.mocked(getReporteMensual).mockResolvedValue(reporteCO());
  });

  it("sin token ni sesión va a /login, sin tocar la base", async () => {
    await expect(abrir(BASE)).rejects.toThrow("NEXT_REDIRECT /login");
    expect(getReporteMensual).not.toHaveBeenCalled();
  });

  it("un token que no es de este reporte tampoco entra", async () => {
    await expect(abrir({ ...BASE, token: "x" })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(tokenValido).toHaveBeenCalledWith("x", {
      ...BASE,
      plantilla: "clasico",
    });
  });

  it("con el token de impresión entra (Gotenberg)", async () => {
    vi.mocked(tokenValido).mockResolvedValue(true);
    const el = await abrir({ ...BASE, plantilla: "nuevo", token: "ok" });
    expect(el.type).toBe(ReporteNuevo);
    expect(getReporteMensual).toHaveBeenCalledWith(
      "centenario",
      "co",
      "2026-09",
    );
  });

  it("con sesión entra, y por defecto en la plantilla clásica", async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: "1",
      userName: "Juan",
      email: "juan@example.com",
      role: "VIEWER",
    });
    const el = await abrir({ ...BASE, estacion: ["centenario", "cordoba"] });
    expect(el.type).toBe(ReporteClasico);
  });

  it("parámetros fuera de la lista: 404", async () => {
    await expect(abrir({ ...BASE, estacion: "cifa" })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(getReporteMensual).not.toHaveBeenCalled();
  });
});
