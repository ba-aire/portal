import { describe, expect, it } from "vitest";
import {
  LoginFormSchema,
  RegisterFormSchema,
} from "@/lib/auth/form-validations";

// Devuelve los nombres de campo que tienen al menos un error de validación.
function errorFields(error: { issues: { path: PropertyKey[] }[] }): string[] {
  return error.issues.map((issue) => String(issue.path[0]));
}

describe("LoginFormSchema", () => {
  it("acepta un email válido y una contraseña que cumple las 4 reglas", () => {
    const result = LoginFormSchema.safeParse({
      email: "test@example.com",
      password: "password1!",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        email: "test@example.com",
        password: "password1!",
      });
    }
  });

  it("rechaza un email inválido", () => {
    const result = LoginFormSchema.safeParse({
      email: "no-es-un-email",
      password: "password1!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(errorFields(result.error)).toContain("email");
    }
  });

  it("rechaza una contraseña de menos de 8 caracteres", () => {
    const result = LoginFormSchema.safeParse({
      email: "test@example.com",
      password: "Ab1!", // 4 chars
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(errorFields(result.error)).toContain("password");
    }
  });

  it("rechaza una contraseña sin letras", () => {
    const result = LoginFormSchema.safeParse({
      email: "test@example.com",
      password: "12345678!",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza una contraseña sin números", () => {
    const result = LoginFormSchema.safeParse({
      email: "test@example.com",
      password: "password!",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza una contraseña sin caracteres especiales", () => {
    const result = LoginFormSchema.safeParse({
      email: "test@example.com",
      password: "password1",
    });

    expect(result.success).toBe(false);
  });
});

describe("RegisterFormSchema", () => {
  const validInput = {
    name: "Juan",
    lastName: "Perez",
    email: "juan@example.com",
    password: "password1!",
    role: "EDITOR" as const,
  };

  it("acepta un registro válido", () => {
    const result = RegisterFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validInput);
    }
  });

  it.each(["ADMIN", "EDITOR", "VIEWER"])("acepta el rol válido %s", (role) => {
    const result = RegisterFormSchema.safeParse({ ...validInput, role });
    expect(result.success).toBe(true);
  });

  it("rechaza un rol fuera del enum", () => {
    const result = RegisterFormSchema.safeParse({
      ...validInput,
      role: "SUPERADMIN",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(errorFields(result.error)).toContain("role");
    }
  });

  it("rechaza un nombre de menos de 2 caracteres", () => {
    const result = RegisterFormSchema.safeParse({ ...validInput, name: "J" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(errorFields(result.error)).toContain("name");
    }
  });

  it("rechaza un apellido de menos de 2 caracteres", () => {
    const result = RegisterFormSchema.safeParse({
      ...validInput,
      lastName: "P",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(errorFields(result.error)).toContain("lastName");
    }
  });

  it("reporta múltiples campos inválidos a la vez", () => {
    const result = RegisterFormSchema.safeParse({
      name: "",
      lastName: "",
      email: "mal",
      password: "x",
      role: "NOPE",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = errorFields(result.error);
      expect(fields).toEqual(
        expect.arrayContaining([
          "name",
          "lastName",
          "email",
          "password",
          "role",
        ]),
      );
    }
  });
});
