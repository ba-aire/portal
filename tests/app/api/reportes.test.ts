// @vitest-environment node
//
// La ruta del reporte mensual decide, antes de bajar a la base: que haya sesión,
// que estación, contaminante, mes y plantilla sean de la lista, y que un fallo
// interno no le cuente al cliente nada de la base. Después elige JSON o PDF
// (el PDF lo imprime Gotenberg: acá va mockeado).
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/reportes/service", () => ({ getReporteMensual: vi.fn() }));
vi.mock("@/lib/reportes/impresion", async () => {
  const real = await vi.importActual<typeof import("@/lib/reportes/impresion")>(
    "@/lib/reportes/impresion",
  );
  return {
    ImpresionNoConfigurada: real.ImpresionNoConfigurada,
    generarPdf: vi.fn(),
    nombreDeArchivo: vi.fn(() => "co_centenario_septiembre_2026_clasico.pdf"),
  };
});

import { GET } from "@/app/api/reportes/mensual/route";
import { getSession } from "@/lib/auth-session";
import { generarPdf, ImpresionNoConfigurada } from "@/lib/reportes/impresion";
import { getReporteMensual } from "@/lib/reportes/service";
import { reporteCO } from "../../lib/reportes/fixture";

const SESION = {
  userId: "1",
  userName: "Juan",
  email: "juan@example.com",
  role: "VIEWER",
};

function pedido(query: string) {
  return new NextRequest(`http://localhost/api/reportes/mensual?${query}`);
}

describe("GET /api/reportes/mensual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(SESION);
    vi.mocked(getReporteMensual).mockResolvedValue(reporteCO());
    vi.mocked(generarPdf).mockResolvedValue(Buffer.from("%PDF-1.3 prueba"));
  });

  it("responde 401 sin sesión, sin tocar la base", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await GET(
      pedido("estacion=centenario&contaminante=co&mes=2026-09"),
    );
    expect(res.status).toBe(401);
    expect(getReporteMensual).not.toHaveBeenCalled();
  });

  it("por defecto devuelve el JSON", async () => {
    const res = await GET(
      pedido("estacion=centenario&contaminante=co&mes=2026-09"),
    );
    expect(res.status).toBe(200);
    expect(getReporteMensual).toHaveBeenCalledWith(
      "centenario",
      "co",
      "2026-09",
    );
    await expect(res.json()).resolves.toMatchObject({
      contaminante: "co",
      mes: "2026-09",
    });
    expect(generarPdf).not.toHaveBeenCalled();
  });

  it("con formato=pdf devuelve el PDF de la plantilla pedida, como adjunto", async () => {
    const res = await GET(
      pedido(
        "estacion=centenario&contaminante=co&mes=2026-09&formato=pdf&plantilla=nuevo",
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(
      'filename="co_centenario_septiembre_2026_clasico.pdf"',
    );
    expect(generarPdf).toHaveBeenCalledWith({
      estacion: "centenario",
      contaminante: "co",
      mes: "2026-09",
      plantilla: "nuevo",
    });
    // El PDF lo arma la página de impresión: la ruta no consulta la base.
    expect(getReporteMensual).not.toHaveBeenCalled();
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe(
      "%PDF-1.3 prueba",
    );
  });

  it("sin plantilla usa la clásica", async () => {
    await GET(
      pedido("estacion=centenario&contaminante=co&mes=2026-09&formato=pdf"),
    );
    expect(vi.mocked(generarPdf).mock.calls[0][0].plantilla).toBe("clasico");
  });

  it("sin Gotenberg configurado responde 503", async () => {
    vi.mocked(generarPdf).mockRejectedValue(
      new ImpresionNoConfigurada("Faltan GOTENBERG_URL o PORTAL_URL_INTERNA"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(
      pedido("estacion=centenario&contaminante=co&mes=2026-09&formato=pdf"),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).not.toContain("GOTENBERG");
  });

  it.each([
    "estacion=cifa&contaminante=co&mes=2026-09",
    "estacion=centenario&contaminante=h2s&mes=2026-09",
    "estacion=centenario&contaminante=co&mes=2026-13",
    "estacion=centenario&contaminante=co&mes=2026-9",
    "estacion=centenario&contaminante=co",
    "estacion=centenario&contaminante=co&mes=2026-09&plantilla=moderna",
    "estacion=centenario&contaminante=co&mes=2026-09&formato=xlsx",
  ])("responde 400 ante %s, sin tocar la base", async (q) => {
    const res = await GET(pedido(q));
    expect(res.status).toBe(400);
    expect(getReporteMensual).not.toHaveBeenCalled();
  });

  it("un error interno es un 500 genérico", async () => {
    vi.mocked(getReporteMensual).mockRejectedValue(
      new Error('relation "reporte.mensual_dias" does not exist'),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(
      pedido("estacion=centenario&contaminante=co&mes=2026-09"),
    );
    expect(res.status).toBe(500);
    const cuerpo = await res.json();
    expect(cuerpo.error).toBe("Error interno al armar el reporte");
    expect(JSON.stringify(cuerpo)).not.toContain("relation");
  });
});
