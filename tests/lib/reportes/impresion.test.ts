// @vitest-environment node
//
// Del HTML al PDF: el token que deja entrar a Gotenberg (solo a ESE reporte y
// por poco tiempo) y el pedido que se le manda. Gotenberg va mockeado: lo que se
// verifica es qué se le pide.
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consultaDe,
  firmarToken,
  generarPdf,
  ImpresionNoConfigurada,
  LISTA_PARA_IMPRIMIR,
  nombreDeArchivo,
  type ReportePedido,
  rutaDelReporte,
  tokenValido,
} from "@/lib/reportes/impresion";

const PEDIDO: ReportePedido = {
  estacion: "centenario",
  contaminante: "co",
  mes: "2026-09",
  plantilla: "clasico",
};

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "secreto-de-prueba-de-32-caracteres!!");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("token de impresión", () => {
  it("vale para el reporte firmado", async () => {
    expect(await tokenValido(await firmarToken(PEDIDO), PEDIDO)).toBe(true);
  });

  it.each([
    ["otra estación", { estacion: "cordoba" }],
    ["otro contaminante", { contaminante: "pm10" }],
    ["otro mes", { mes: "2026-08" }],
    ["otra plantilla", { plantilla: "nuevo" }],
  ] as const)("no vale para %s", async (_, cambio) => {
    const token = await firmarToken(PEDIDO);
    expect(await tokenValido(token, { ...PEDIDO, ...cambio })).toBe(false);
  });

  it("vence a los dos minutos", async () => {
    const token = await firmarToken(PEDIDO);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 3 * 60 * 1000);
    expect(await tokenValido(token, PEDIDO)).toBe(false);
  });

  it("una sesión del portal no sirve como token (otra audiencia)", async () => {
    const sesion = await new SignJWT({ userId: "1", ...PEDIDO })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    expect(await tokenValido(sesion, PEDIDO)).toBe(false);
  });

  it("firmado con otra clave no vale", async () => {
    const token = await firmarToken(PEDIDO);
    vi.stubEnv("SESSION_SECRET", "otra-clave-distinta-de-32-caracteres!");
    expect(await tokenValido(token, PEDIDO)).toBe(false);
  });

  it("sin SESSION_SECRET no firma", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    await expect(firmarToken(PEDIDO)).rejects.toThrow("SESSION_SECRET");
  });

  it("basura no es un token", async () => {
    expect(await tokenValido("no.es.jwt", PEDIDO)).toBe(false);
  });
});

describe("ruta del reporte", () => {
  it("lleva los cuatro parámetros y ningún token", () => {
    expect(Object.fromEntries(consultaDe(PEDIDO))).toEqual(PEDIDO);
    expect(rutaDelReporte(PEDIDO)).toMatch(
      /\/imprimir\/reporte-mensual\?estacion=centenario&contaminante=co&mes=2026-09&plantilla=clasico$/,
    );
  });
});

describe("generarPdf", () => {
  it("sin Gotenberg configurado no intenta nada", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("GOTENBERG_URL", "");
    vi.stubEnv("PORTAL_URL_INTERNA", "http://portal:3000");
    await expect(generarPdf(PEDIDO)).rejects.toBeInstanceOf(
      ImpresionNoConfigurada,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("le pide a Gotenberg la página del reporte, con su token, en A4 de la página", async () => {
    vi.stubEnv("GOTENBERG_URL", "http://gotenberg:3000");
    vi.stubEnv("PORTAL_URL_INTERNA", "http://portal:3000");
    const fetch = vi.fn(async () => new Response("%PDF-1.7 prueba"));
    vi.stubGlobal("fetch", fetch);

    const pdf = await generarPdf(PEDIDO);
    expect(pdf.toString()).toBe("%PDF-1.7 prueba");

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://gotenberg:3000/forms/chromium/convert/url");
    const form = init.body as FormData;
    const pagina = new URL(form.get("url") as string);
    expect(pagina.origin).toBe("http://portal:3000");
    expect(pagina.pathname).toMatch(/\/imprimir\/reporte-mensual$/);
    const token = pagina.searchParams.get("token") as string;
    expect(await tokenValido(token, PEDIDO)).toBe(true);
    expect(form.get("preferCssPageSize")).toBe("true");
    expect(form.get("printBackground")).toBe("true");
    expect(form.get("marginTop")).toBe("0");
    expect(form.get("waitForExpression")).toBe(LISTA_PARA_IMPRIMIR);
  });

  it("si Gotenberg falla, el error dice el estado", async () => {
    vi.stubEnv("GOTENBERG_URL", "http://gotenberg:3000");
    vi.stubEnv("PORTAL_URL_INTERNA", "http://portal:3000");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("timeout", { status: 503 })),
    );
    await expect(generarPdf(PEDIDO)).rejects.toThrow("503");
  });
});

describe("LISTA_PARA_IMPRIMIR", () => {
  // La evalúa Chromium; acá, contra un document de mentira.
  const evaluar = (doc: {
    fonts: { load: () => Promise<unknown> };
    querySelector: (s: string) => unknown;
  }) => {
    const w: Record<string, unknown> = {};
    return () =>
      new Function("window", "document", `return (${LISTA_PARA_IMPRIMIR});`)(
        w,
        doc,
      );
  };

  it("espera a que las fuentes terminen de cargar y a que haya hojas", async () => {
    const cargar: (() => void)[] = [];
    const load = vi.fn(
      () =>
        new Promise<void>((r) => {
          cargar.push(r);
        }),
    );
    let hojas: unknown = null;
    const lista = evaluar({ fonts: { load }, querySelector: () => hojas });
    expect(lista()).toBe(false);
    expect(load).toHaveBeenCalledTimes(3); // 400, 600 y 700, una sola vez
    hojas = {};
    expect(lista()).toBe(false); // hay hojas, pero las fuentes no llegaron
    for (const r of cargar) r();
    await new Promise((r) => setTimeout(r, 0));
    expect(lista()).toBe(true);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("sin hojas (el login, si el token no sirvió) no imprime nunca", async () => {
    const lista = evaluar({
      fonts: { load: async () => [] },
      querySelector: () => null,
    });
    lista();
    await new Promise((r) => setTimeout(r, 0));
    expect(lista()).toBe(false);
  });
});

describe("nombreDeArchivo", () => {
  it("la clásica, como los PDF publicados: contaminante_estacion_mes_anio", () => {
    expect(nombreDeArchivo(PEDIDO)).toBe("co_centenario_septiembre_2026.pdf");
  });

  it("la nueva, con _nuevo al final", () => {
    expect(
      nombreDeArchivo({
        estacion: "catalinas",
        contaminante: "nox",
        mes: "2026-09",
        plantilla: "nuevo",
      }),
    ).toBe("nox_laboca_septiembre_2026_nuevo.pdf");
  });

  it("la de ACUMAR, con _acumar al final; la estación sin espacios", () => {
    expect(
      nombreDeArchivo({
        estacion: "catalinas",
        contaminante: "nox",
        mes: "2025-02",
        plantilla: "acumar",
      }),
    ).toBe("nox_laboca_febrero_2025_acumar.pdf");
    expect(nombreDeArchivo({ ...PEDIDO, estacion: "cordoba" })).toBe(
      "co_cordoba_septiembre_2026.pdf",
    );
  });
});
