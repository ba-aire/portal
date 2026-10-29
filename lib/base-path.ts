// La app se sirve bajo un prefijo (https://10.22.1.113/portal), así otras apps
// pueden compartir el mismo host y el mismo certificado detrás de caddy.
//
// Next lo agrega solo en <Link>, router.push, redirect() y en los redirects que se
// arman con req.nextUrl. NO lo agrega en fetch(), EventSource, <img>/next/image
// con rutas de /public, ni en `new URL("/algo", ...)`: esos pasan por acá.
//
// El valor sale de next.config.mjs (basePath), que lo expone como
// NEXT_PUBLIC_BASE_PATH para que quede inlineado también en el bundle del cliente.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Antepone el basePath a una ruta absoluta de la app ("/api/datos" -> "/portal/api/datos"). */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
