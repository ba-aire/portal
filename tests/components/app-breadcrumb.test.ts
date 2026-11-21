import { describe, expect, it } from "vitest";
import { etiquetaSegmento } from "@/components/app-breadcrumb";

describe("etiquetaSegmento", () => {
  it("las estaciones van con su nombre, no con el código de airedb", () => {
    expect(etiquetaSegmento("catalinas")).toBe("La Boca");
    expect(etiquetaSegmento("cordoba")).toBe("Córdoba");
    expect(etiquetaSegmento("cifa")).toBe("CIFA");
  });

  it("las etiquetas fijas y el resto con mayúscula inicial", () => {
    expect(etiquetaSegmento("ica")).toBe("ICA");
    expect(etiquetaSegmento("validacion")).toBe("Validación");
    expect(etiquetaSegmento("estaciones")).toBe("Estaciones");
    expect(etiquetaSegmento("reporte-mensual")).toBe("Reporte Mensual");
  });
});
