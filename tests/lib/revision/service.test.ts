// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/repository", () => ({ getUserByEmail: vi.fn() }));

import { getUserByEmail } from "@/lib/auth/repository";
import {
  esEditorVigente,
  RevisionRechazada,
  traducirError,
} from "@/lib/revision/service";

function pgError(code: string, message = "", constraint?: string) {
  return Object.assign(new Error(message), { code, constraint });
}

describe("traducirError", () => {
  it("22023: el mensaje propio de la función, con mayúscula", () => {
    const t = traducirError(pgError("22023", "estacion desconocida: nada"));
    expect(t).toBeInstanceOf(RevisionRechazada);
    expect((t as Error).message).toBe("Estacion desconocida: nada");
  });

  it.each([
    ["revision_motivo_ck", "El motivo necesita al menos 10 caracteres"],
    [
      "revision_periodo_ck",
      "El período tiene que tener principio y fin, en minutos enteros",
    ],
    ["revision_registrado_por_ck", "Falta el usuario que registra"],
    ["otra_ck", "La revisión no cumple las reglas de la base"],
    [undefined, "La revisión no cumple las reglas de la base"],
  ])(
    "23514 %s: no muestra el nombre de la constraint",
    (constraint, mensaje) => {
      const t = traducirError(
        pgError("23514", "new row violates...", constraint),
      );
      expect(t).toBeInstanceOf(RevisionRechazada);
      expect((t as Error).message).toBe(mensaje);
    },
  );

  it("23505: ya anulada", () => {
    expect((traducirError(pgError("23505")) as Error).message).toBe(
      "Esa revisión ya está anulada",
    );
  });

  // Todo lo demás es un 500: no se le cuenta al usuario.
  it.each([pgError("42501", "permission denied"), new Error("timeout"), null])(
    "devuelve tal cual %s",
    (e) => {
      expect(traducirError(e)).toBe(e);
    },
  );
});

describe("esEditorVigente", () => {
  beforeEach(() => vi.mocked(getUserByEmail).mockReset());

  const usuario = (role: string, isActive = true) =>
    ({ role, isActive }) as Awaited<ReturnType<typeof getUserByEmail>>;

  it("un EDITOR activo en la base puede", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(usuario("EDITOR"));
    await expect(esEditorVigente("Ana@X.gob.ar", "EDITOR")).resolves.toBe(true);
    expect(getUserByEmail).toHaveBeenCalledWith("ana@x.gob.ar");
  });

  it.each(["ADMIN", "VIEWER"])(
    "%s no puede, sin consultar la base",
    async (rol) => {
      await expect(esEditorVigente("a@x", rol)).resolves.toBe(false);
      expect(getUserByEmail).not.toHaveBeenCalled();
    },
  );

  // La cookie dura 7 h: si lo deshabilitaron o le cambiaron el rol, no escribe.
  it.each([
    ["deshabilitado", usuario("EDITOR", false)],
    ["pasado a VIEWER", usuario("VIEWER")],
    ["borrado", null],
  ])("con la cookie de EDITOR pero %s, no puede", async (_caso, u) => {
    vi.mocked(getUserByEmail).mockResolvedValue(u);
    await expect(esEditorVigente("a@x", "EDITOR")).resolves.toBe(false);
  });
});
