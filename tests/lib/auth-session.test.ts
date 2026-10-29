// @vitest-environment node
//
// jose firma/verifica JWT con crypto. Bajo el entorno jsdom, jose resuelve su
// build de Web Crypto y el Uint8Array de jsdom falla el chequeo `instanceof`
// (distinto realm). Corriendo este archivo en el entorno `node`, jose usa su
// build de Node y el round-trip funciona. next/headers está mockeado igual.
import { beforeEach, describe, expect, it, vi } from "vitest";

// Cookie store falso. Se crea con vi.hoisted para poder referenciarlo dentro
// del factory de vi.mock (que se eleva al tope del archivo).
const { cookieStore } = vi.hoisted(() => ({
  cookieStore: {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

// El redirect real de Next no retorna: corta la ejecución lanzando un
// NEXT_REDIRECT que el framework atrapa más arriba. Un mock que sólo registra
// la llamada deja seguir el código, y verifySession terminaría leyendo una
// sesión inexistente. El mock replica el corte para probar el flujo real.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

import { SignJWT } from "jose";
import { redirect } from "next/navigation";
import {
  createSession,
  decrypt,
  deleteSession,
  encrypt,
  getSession,
  updateSession,
  verifySession,
} from "@/lib/auth-session";

const samplePayload = {
  userId: "1",
  userName: "Juan",
  role: "ADMIN",
  email: "juan@example.com",
  expiresAt: new Date("2030-01-01T00:00:00.000Z"),
};

describe("auth-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("encrypt / decrypt", () => {
    it("hace round-trip y conserva los datos del payload", async () => {
      const token = await encrypt(samplePayload);
      expect(typeof token).toBe("string");

      const decoded = await decrypt(token);
      expect(decoded).toMatchObject({
        userId: "1",
        userName: "Juan",
        role: "ADMIN",
        email: "juan@example.com",
      });
    });

    it("devuelve undefined ante un token inválido", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const decoded = await decrypt("esto.no.es.un.jwt");

      expect(decoded).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("devuelve undefined cuando no se pasa token", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const decoded = await decrypt();

      expect(decoded).toBeUndefined();
      consoleSpy.mockRestore();
    });
  });

  describe("createSession", () => {
    it("guarda la cookie 'session' con las opciones de seguridad correctas", async () => {
      await createSession("42", "Ana", "EDITOR", "ana@example.com");

      expect(cookieStore.set).toHaveBeenCalledTimes(1);
      const [name, token, options] = cookieStore.set.mock.calls[0];

      expect(name).toBe("session");
      expect(typeof token).toBe("string");
      expect(options).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      });
      expect(options.expires).toBeInstanceOf(Date);
    });

    it("guarda un token que decripta de vuelta al payload del usuario", async () => {
      await createSession("42", "Ana", "EDITOR", "ana@example.com");

      const token = cookieStore.set.mock.calls[0][1] as string;
      const decoded = await decrypt(token);

      expect(decoded).toMatchObject({
        userId: "42",
        userName: "Ana",
        role: "EDITOR",
        email: "ana@example.com",
      });
    });
  });

  describe("deleteSession", () => {
    it("elimina la cookie 'session'", async () => {
      await deleteSession();

      expect(cookieStore.delete).toHaveBeenCalledWith("session");
    });
  });

  /** Deja en el cookie store un token de sesión válido para el usuario dado. */
  async function conSesion(overrides: Partial<typeof samplePayload> = {}) {
    const token = await encrypt({ ...samplePayload, ...overrides });
    cookieStore.get.mockReturnValue({ value: token });
    return token;
  }

  describe("getSession", () => {
    it("devuelve los datos del usuario con una sesión válida", async () => {
      await conSesion();

      expect(await getSession()).toEqual({
        userId: "1",
        userName: "Juan",
        role: "ADMIN",
        email: "juan@example.com",
      });
    });

    it("devuelve null cuando no hay cookie de sesión", async () => {
      cookieStore.get.mockReturnValue(undefined);

      expect(await getSession()).toBeNull();
    });

    it("devuelve null ante un token manipulado", async () => {
      const consola = vi.spyOn(console, "error").mockImplementation(() => {});
      const token = await conSesion();
      // Se altera el payload dejando intacta la firma: es el ataque obvio
      // contra un JWT, y jose lo tiene que rechazar por firma inválida.
      const [header, , firma] = token.split(".");
      const payloadFalso = Buffer.from(
        JSON.stringify({ userId: "999", role: "ADMIN" }),
      ).toString("base64url");
      cookieStore.get.mockReturnValue({
        value: `${header}.${payloadFalso}.${firma}`,
      });

      expect(await getSession()).toBeNull();
      consola.mockRestore();
    });

    // Un token vencido está bien firmado: si no se chequeara el exp, una sesión
    // robada serviría para siempre. jose lo valida, y esto lo deja fijado.
    it("devuelve null con un token expirado", async () => {
      const consola = vi.spyOn(console, "error").mockImplementation(() => {});
      const vencido = await new SignJWT({ userId: "1", role: "ADMIN" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
      cookieStore.get.mockReturnValue({ value: vencido });

      expect(await getSession()).toBeNull();
      consola.mockRestore();
    });

    it("devuelve null si el token es válido pero no identifica a nadie", async () => {
      const sinUsuario = await new SignJWT({ role: "ADMIN" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
      cookieStore.get.mockReturnValue({ value: sinUsuario });

      expect(await getSession()).toBeNull();
    });

    // Esta es la diferencia con verifySession y la razón de que exista: un
    // route handler necesita responder 401. Un redirect 307 es inútil para un
    // fetch() o un EventSource, que lo siguen y reciben HTML.
    it("no redirige cuando no hay sesión", async () => {
      cookieStore.get.mockReturnValue(undefined);

      await getSession();

      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("verifySession", () => {
    it("devuelve isAuth y los datos con una sesión válida", async () => {
      await conSesion({ userId: "7", userName: "Ana", role: "VIEWER" });

      const resultado = await verifySession();

      expect(resultado.isAuth).toBe(true);
      expect(resultado.data).toMatchObject({ userId: "7", userName: "Ana" });
      expect(redirect).not.toHaveBeenCalled();
    });

    it("redirige a la raíz cuando no hay sesión", async () => {
      cookieStore.get.mockReturnValue(undefined);

      // El redirect corta: nunca se llega a devolver un objeto de sesión.
      await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT:/");
      expect(redirect).toHaveBeenCalledWith("/");
    });

    it("redirige ante un token inválido", async () => {
      const consola = vi.spyOn(console, "error").mockImplementation(() => {});
      cookieStore.get.mockReturnValue({ value: "no.es.un.jwt" });

      await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT:/");
      expect(redirect).toHaveBeenCalledWith("/");
      consola.mockRestore();
    });
  });

  describe("updateSession", () => {
    it("renueva la expiración de la cookie con la sesión vigente", async () => {
      const token = await conSesion();

      await updateSession();

      expect(cookieStore.set).toHaveBeenCalledTimes(1);
      const [nombre, valor, opciones] = cookieStore.set.mock.calls[0];
      expect(nombre).toBe("session");
      // El token no se re-firma, sólo se corre el vencimiento de la cookie.
      expect(valor).toBe(token);
      expect(opciones.expires.getTime()).toBeGreaterThan(Date.now());
    });

    it("no toca la cookie cuando no hay sesión", async () => {
      cookieStore.get.mockReturnValue(undefined);

      expect(await updateSession()).toBeNull();
      expect(cookieStore.set).not.toHaveBeenCalled();
    });

    it("no renueva una sesión con token inválido", async () => {
      const consola = vi.spyOn(console, "error").mockImplementation(() => {});
      cookieStore.get.mockReturnValue({ value: "no.es.un.jwt" });

      expect(await updateSession()).toBeNull();
      expect(cookieStore.set).not.toHaveBeenCalled();
      consola.mockRestore();
    });
  });
});
