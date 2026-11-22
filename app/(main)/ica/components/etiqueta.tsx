import { COLOR_SIN_DATO, colorDeTexto } from "@/lib/ica/presentacion";

/** La categoría con su color, y el texto legible sobre ese color. */
export function Etiqueta({
  color,
  children,
}: {
  color: string | null;
  children: React.ReactNode;
}) {
  const fondo = color ?? COLOR_SIN_DATO;
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold"
      style={{ backgroundColor: fondo, color: colorDeTexto(fondo) }}
    >
      {children}
    </span>
  );
}
