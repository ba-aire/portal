// Los datos minutales se piden de a un día: más rango satura la memoria del
// navegador (y la del Postgres) y no es lo que se explora a esa resolución.
// El usuario elige un día y una franja horaria: "desde" 0-23 y "hasta" 1-24,
// donde "hasta" es exclusivo (08:00 a 18:00 trae los minutos 08:00 a 17:59).

export const HORA_DESDE_DEFECTO = 0;
export const HORA_HASTA_DEFECTO = 24;

export const HORAS_DESDE = Array.from({ length: 24 }, (_, h) => h);
export const HORAS_HASTA = Array.from({ length: 24 }, (_, h) => h + 1);

export function etiquetaHora(hora: number): string {
  return `${String(hora).padStart(2, "0")}:00`;
}

/**
 * Instantes de inicio y fin (exclusivo) de la franja elegida. Se arma con la
 * hora local del navegador, igual que el calendario entrega la medianoche del
 * día: la hora 24 resuelve a la medianoche del día siguiente.
 */
export function ventanaMinutal(
  dia: Date,
  horaDesde: number = HORA_DESDE_DEFECTO,
  horaHasta: number = HORA_HASTA_DEFECTO,
): { start: Date; end: Date } {
  const armar = (hora: number) =>
    new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora);
  return { start: armar(horaDesde), end: armar(horaHasta) };
}
