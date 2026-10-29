import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/auth-session";

// 1. Specify protected and public routes
//
// Cada entrada cubre su subárbol completo (ver `matches`), no sólo la ruta exacta:
// "/estaciones" tiene que alcanzar también a "/estaciones/centenario".
//
// No figura "/api": el matcher de abajo excluye esa rama, así que el proxy nunca
// corre ahí. Cada route handler verifica su propia sesión y devuelve 401.
// Tampoco "/": se resuelve en el bloque especial de más abajo, antes de llegar acá.
const protectedRoutes = [
  "/admin",
  "/aqi",
  "/datos",
  "/descargas",
  "/estaciones",
  "/inventario",
  "/mantenimiento",
  "/reportes",
];
const publicRoutes = ["/login"];

// Coincide con la ruta exacta o con un subpath, pero sin dar falsos positivos por
// prefijo suelto: "/datos" cubre "/datos/contaminante" y no "/datos-publicos".
function matches(path: string, routes: string[]) {
  return routes.some((route) => path === route || path.startsWith(`${route}/`));
}

// Arma el CSP con un nonce nuevo por request. Next lee el nonce del header
// Content-Security-Policy del request y se lo aplica a sus propios scripts inline
// (los de streaming del RSC payload); 'strict-dynamic' habilita a que esos scripts
// carguen el resto del bundle.
//
// Dos concesiones deliberadas:
// - style-src 'unsafe-inline': Radix UI y MapLibre escriben estilos inline en runtime
//   (portales, popovers, canvas) sin manera de pasarles un nonce. La inyección de
//   estilos es bastante menos grave que la de scripts, que sí queda cerrada.
// - worker-src blob:: MapLibre levanta sus workers de WebGL desde blob URLs.
function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // dicebear: avatares del sidebar. openstreetmap: tiles raster del mapa.
    "img-src 'self' blob: data: https://api.dicebear.com https://tile.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self' https://tile.openstreetmap.org",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export default async function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Next extrae el nonce de este header del request para inyectarlo en sus scripts.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // 2. Check if the current route is protected or public
  const path = req.nextUrl.pathname;
  const isProtectedRoute = matches(path, protectedRoutes);
  const isPublicRoute = matches(path, publicRoutes);

  // 3. Decrypt the session from the cookie
  const cookie = (await cookies()).get("session")?.value;
  const session = await decrypt(cookie);

  // Redirigir a /login o /inicio si el usuario ingresa a "/"
  if (path === "/") {
    if (session?.userId) {
      return NextResponse.redirect(
        new URL("/estaciones/centenario", req.nextUrl),
      );
    } else {
      return NextResponse.redirect(new URL("/login", req.nextUrl));
    }
  }

  // 4. Redirect to /login if the user is not authenticated
  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 5. Redirect to /inicio if the user is authenticated
  if (
    isPublicRoute &&
    session?.userId &&
    !req.nextUrl.pathname.startsWith("/estaciones/centenario")
  ) {
    return NextResponse.redirect(
      new URL("/estaciones/centenario", req.nextUrl),
    );
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// Routes Proxy should not run on
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
