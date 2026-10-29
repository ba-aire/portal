import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginUser } from "@/lib/auth/service";

vi.mock("@/lib/auth/repository", () => ({
  getUserByEmail: vi.fn(),
  insertUser: vi.fn(),
}));

vi.mock("@/lib/auth-session", () => ({
  createSession: vi.fn(),
}));

// El rate limiter pega contra Postgres; acá interesa cómo lo usa loginUser,
// no la query en sí. Su lógica se prueba aparte en rate-limit.test.ts.
vi.mock("@/lib/auth/rate-limit", () => ({
  WINDOW_MINUTES: 15,
  isRateLimited: vi.fn(async () => false),
  recordFailedAttempt: vi.fn(),
  clearAttempts: vi.fn(),
}));

import {
  clearAttempts,
  isRateLimited,
  recordFailedAttempt,
} from "@/lib/auth/rate-limit";
import { getUserByEmail } from "@/lib/auth/repository";

const usuarioExistente = {
  id: 1,
  name: "Juan",
  lastName: "Pérez",
  email: "juan@example.com",
  // hash real de "password123!" con cost 10
  password: bcrypt.hashSync("password123!", 10),
  role: "VIEWER",
};

describe("loginUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("rechaza sin consultar al usuario cuando el cupo está agotado", async () => {
    vi.mocked(isRateLimited).mockResolvedValue(true);

    const result = await loginUser(
      { email: "juan@example.com", password: "password123!" } as never,
      "203.0.113.7",
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/demasiados intentos/i);
    // El corte va antes de tocar la DB y antes de bcrypt, que es la parte cara:
    // si no, un atacante bloqueado igual consume CPU en cada request.
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("registra el intento fallido con email e IP cuando la contraseña no coincide", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(usuarioExistente as never);

    await loginUser(
      { email: "juan@example.com", password: "incorrecta-999!" } as never,
      "203.0.113.7",
    );

    expect(recordFailedAttempt).toHaveBeenCalledWith(
      "juan@example.com",
      "203.0.113.7",
    );
  });

  it("registra el intento fallido también cuando el usuario no existe", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    await loginUser(
      { email: "nadie@example.com", password: "password123!" } as never,
      "203.0.113.7",
    );

    // Si sólo se contaran los fallos de usuarios existentes, el rate limit se
    // volvería otro oráculo de enumeración.
    expect(recordFailedAttempt).toHaveBeenCalledWith(
      "nadie@example.com",
      "203.0.113.7",
    );
  });

  it("limpia los intentos del email tras un login exitoso", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(usuarioExistente as never);

    await loginUser(
      { email: "juan@example.com", password: "password123!" } as never,
      "203.0.113.7",
    );

    expect(clearAttempts).toHaveBeenCalledWith("juan@example.com");
    expect(recordFailedAttempt).not.toHaveBeenCalled();
  });

  // El login no debe permitir distinguir "ese correo no existe" de "esa
  // contraseña no es", ni por el mensaje ni por el tiempo de respuesta: las dos
  // cosas permiten enumerar qué correos están registrados.
  it("devuelve el mismo mensaje para usuario inexistente y contraseña incorrecta", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    const inexistente = await loginUser({
      email: "nadie@example.com",
      password: "password123!",
    } as never);

    vi.mocked(getUserByEmail).mockResolvedValue(usuarioExistente as never);
    const passwordMala = await loginUser({
      email: "juan@example.com",
      password: "otra-cosa-999!",
    } as never);

    expect(inexistente.success).toBe(false);
    expect(passwordMala.success).toBe(false);
    expect(inexistente.message).toBe(passwordMala.message);
    // Y el mensaje no nombra cuál de las dos causas fue.
    expect(inexistente.message).not.toMatch(/no encontrado|no existe/i);
    expect(passwordMala.message).not.toMatch(/contraseña incorrecta/i);
  });

  it("compara contra un hash dummy cuando el usuario no existe, para igualar el tiempo", async () => {
    const compareSpy = vi.spyOn(bcrypt, "compare");
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    await loginUser({
      email: "nadie@example.com",
      password: "password123!",
    } as never);

    // Sin esta comparación, la rama "usuario inexistente" retorna sin pagar el
    // costo de bcrypt y el tiempo de respuesta delata que el correo no existe.
    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.mockRestore();
  });

  it("acepta credenciales válidas", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(usuarioExistente as never);

    const result = await loginUser({
      email: "juan@example.com",
      password: "password123!",
    } as never);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ id: 1, email: "juan@example.com" });
  });
});
