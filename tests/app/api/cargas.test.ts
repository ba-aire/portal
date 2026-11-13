// @vitest-environment node
//
// Las rutas de carga manual: quién entra (sesión para leer, EDITOR o ADMIN vigente para
// escribir), qué se rechaza con 400 antes de tocar la base, y qué se le cuenta
// al cliente cuando la base dice que no (un 400 con un mensaje para mostrar) o
// cuando falla otra cosa (un 500 genérico).
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/carga/repository", () => ({
  listarCargas: vi.fn(),
  registrarCarga: vi.fn(),
  fetchVistaPrevia: vi.fn(),
  anularCarga: vi.fn(),
}));
vi.mock("@/lib/revision/service", async (original) => ({
  ...(await original<typeof import("@/lib/revision/service")>()),
  puedeRevisar: vi.fn(),
}));

import { POST as anular } from "@/app/api/cargas/[id]/anular/route";
import { GET, POST } from "@/app/api/cargas/route";
import { POST as vistaPrevia } from "@/app/api/cargas/vista-previa/route";
import { getSession } from "@/lib/auth-session";
import {
  anularCarga,
  fetchVistaPrevia,
  listarCargas,
  registrarCarga,
} from "@/lib/carga/repository";
import { puedeRevisar } from "@/lib/revision/service";

const SESION = {
  userId: "1",
  userName: "Ana",
  email: "ana@example.com",
  role: "EDITOR",
};

const HORA = {
  parameter_code: "no",
  ts_hour: "2026-09-11T08:00:00.000Z",
  value: 5.26,
};
const ALTA = {
  station_code: "cordoba",
  archivo: "nox.csv",
  motivo: "Corte de telemetría, bajado del analizador",
  horas: [HORA],
};

const URL_BASE = "http://localhost/api/cargas";
const get = (q = "") => new NextRequest(`${URL_BASE}${q}`);
const post = (url: string, cuerpo: unknown) =>
  new NextRequest(url, {
    method: "POST",
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const pgError = (code: string, message: string) =>
  Object.assign(new Error(message), { code });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue(SESION);
  vi.mocked(puedeRevisar).mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/cargas", () => {
  it("401 sin sesión, sin tocar la base", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await GET(get())).status).toBe(401);
    expect(listarCargas).not.toHaveBeenCalled();
  });

  // Leer lo puede cualquiera con sesión.
  it("200 para un VIEWER, con los filtros parseados", async () => {
    vi.mocked(getSession).mockResolvedValue({ ...SESION, role: "VIEWER" });
    vi.mocked(listarCargas).mockResolvedValue([]);
    const res = await GET(get("?estado=todas&station_code=cifa"));
    expect(res.status).toBe(200);
    expect(listarCargas).toHaveBeenCalledWith({
      estado: "todas",
      station_code: "cifa",
    });
  });

  it("400 con filtros inválidos", async () => {
    const res = await GET(get("?estado=borradas"));
    expect(res.status).toBe(400);
    expect(listarCargas).not.toHaveBeenCalled();
  });

  it("500 genérico si falla la base", async () => {
    vi.mocked(listarCargas).mockRejectedValue(new Error("relation x"));
    const res = await GET(get());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Error interno al listar las cargas",
    });
  });
});

describe("POST /api/cargas", () => {
  it("401 sin sesión", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await POST(post(URL_BASE, ALTA))).status).toBe(401);
  });

  it("403 si no es un EDITOR o ADMIN vigente, sin tocar la base", async () => {
    vi.mocked(puedeRevisar).mockResolvedValue(false);
    const res = await POST(post(URL_BASE, ALTA));
    expect(res.status).toBe(403);
    expect(puedeRevisar).toHaveBeenCalledWith("ana@example.com", "EDITOR");
    expect(registrarCarga).not.toHaveBeenCalled();
  });

  it.each([
    ["un cuerpo que no es JSON", "{no es json"],
    ["un motivo corto", { ...ALTA, motivo: "corto" }],
  ])("400 ante %s", async (_caso, cuerpo) => {
    const res = await POST(post(URL_BASE, cuerpo));
    expect(res.status).toBe(400);
    expect(registrarCarga).not.toHaveBeenCalled();
  });

  // Quién registra sale de la sesión: un `registrado_por` en el cuerpo no cuenta.
  it("201 con el id, registrado a nombre de la sesión", async () => {
    vi.mocked(registrarCarga).mockResolvedValue(12);
    const res = await POST(
      post(URL_BASE, { ...ALTA, registrado_por: "otro@x" }),
    );
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ carga_id: 12 });
    expect(vi.mocked(registrarCarga).mock.calls[0][1]).toBe("ana@example.com");
  });

  it("400 con el mensaje de la base cuando la rechaza", async () => {
    vi.mocked(registrarCarga).mockRejectedValue(
      pgError("22023", "parametro desconocido: h2s"),
    );
    const res = await POST(post(URL_BASE, ALTA));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Parametro desconocido: h2s",
    });
  });

  it("500 genérico ante cualquier otro error", async () => {
    vi.mocked(registrarCarga).mockRejectedValue(
      pgError("42501", "permission denied for table hora"),
    );
    const res = await POST(post(URL_BASE, ALTA));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Error interno al registrar la carga",
    });
  });
});

describe("POST /api/cargas/vista-previa", () => {
  const URL_VP = `${URL_BASE}/vista-previa`;
  const { archivo: _a, motivo: _m, ...PEDIDO } = ALTA;

  it("401 sin sesión", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await vistaPrevia(post(URL_VP, PEDIDO))).status).toBe(401);
  });

  it.each([
    ["un pedido inválido", { ...PEDIDO, horas: [] }],
    ["un cuerpo que no es JSON", "{no es json"],
  ])("400 con %s", async (_caso, cuerpo) => {
    const res = await vistaPrevia(post(URL_VP, cuerpo));
    expect(res.status).toBe(400);
    expect(fetchVistaPrevia).not.toHaveBeenCalled();
  });

  it("200 con la vista previa", async () => {
    vi.mocked(fetchVistaPrevia).mockResolvedValue({
      parametros: [],
    });
    const res = await vistaPrevia(post(URL_VP, PEDIDO));
    expect(res.status).toBe(200);
    expect(fetchVistaPrevia).toHaveBeenCalledWith(PEDIDO);
  });

  it("500 genérico si falla la base", async () => {
    vi.mocked(fetchVistaPrevia).mockRejectedValue(new Error("x"));
    expect((await vistaPrevia(post(URL_VP, PEDIDO))).status).toBe(500);
  });
});

describe("POST /api/cargas/:id/anular", () => {
  const url = `${URL_BASE}/3/anular`;
  const MOTIVO = { motivo: "Me equivoqué de estación" };

  it("401 sin sesión", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await anular(post(url, MOTIVO), ctx("3"))).status).toBe(401);
  });

  it("403 si no es un EDITOR o ADMIN vigente", async () => {
    vi.mocked(puedeRevisar).mockResolvedValue(false);
    expect((await anular(post(url, MOTIVO), ctx("3"))).status).toBe(403);
    expect(anularCarga).not.toHaveBeenCalled();
  });

  it("404 con un id que no es un número", async () => {
    expect((await anular(post(url, MOTIVO), ctx("abc"))).status).toBe(404);
  });

  it.each([
    ["sin motivo", {}],
    ["con un cuerpo que no es JSON", "{no es json"],
  ])("400 %s", async (_caso, cuerpo) => {
    expect((await anular(post(url, cuerpo), ctx("3"))).status).toBe(400);
  });

  it("201 a nombre de la sesión", async () => {
    vi.mocked(anularCarga).mockResolvedValue(13);
    const res = await anular(post(url, MOTIVO), ctx("3"));
    expect(res.status).toBe(201);
    expect(anularCarga).toHaveBeenCalledWith(
      3,
      "Me equivoqué de estación",
      "ana@example.com",
    );
  });

  it("400 si ya estaba anulada", async () => {
    vi.mocked(anularCarga).mockRejectedValue(pgError("23505", "dup"));
    const res = await anular(post(url, MOTIVO), ctx("3"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Esa carga ya está anulada",
    });
  });

  it("500 genérico ante cualquier otro error", async () => {
    vi.mocked(anularCarga).mockRejectedValue(new Error("x"));
    expect((await anular(post(url, MOTIVO), ctx("3"))).status).toBe(500);
  });
});
