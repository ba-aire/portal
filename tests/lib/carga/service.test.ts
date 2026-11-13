// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CargaRechazada, traducirError } from "@/lib/carga/service";

const pgError = (code: string, message = "", constraint?: string) =>
  Object.assign(new Error(message), { code, constraint });

describe("traducirError", () => {
  it("22023: el mensaje propio de la función, con mayúscula", () => {
    const t = traducirError(pgError("22023", "parametro desconocido: h2s"));
    expect(t).toBeInstanceOf(CargaRechazada);
    expect((t as Error).message).toBe("Parametro desconocido: h2s");
  });

  it.each([
    ["carga_motivo_ck", "El motivo necesita al menos 10 caracteres"],
    ["carga_registrado_por_ck", "Falta el usuario que registra"],
    ["hora_en_punto_ck", "Las horas tienen que estar en punto"],
    ["otra_ck", "La carga no cumple las reglas de la base"],
    [undefined, "La carga no cumple las reglas de la base"],
  ])(
    "23514 %s: no muestra el nombre de la constraint",
    (constraint, mensaje) => {
      expect(
        (
          traducirError(
            pgError("23514", "new row violates", constraint),
          ) as Error
        ).message,
      ).toBe(mensaje);
    },
  );

  it("23505: ya anulada", () => {
    expect((traducirError(pgError("23505")) as Error).message).toBe(
      "Esa carga ya está anulada",
    );
  });

  it.each([pgError("42501", "permission denied"), new Error("timeout"), null])(
    "devuelve tal cual %s",
    (e) => {
      expect(traducirError(e)).toBe(e);
    },
  );
});
