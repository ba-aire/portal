/** @type {import('next').NextConfig} */

// Cabeceras que no dependen del request. El Content-Security-Policy NO va acá:
// necesita un nonce distinto por request y se arma en proxy.ts.
const securityHeaders = [
  // Sin sniffing de MIME: un .csv servido como text/csv no se reinterpreta como HTML.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Anti-clickjacking. Duplica frame-ancestors del CSP para navegadores viejos.
  { key: "X-Frame-Options", value: "DENY" },
  // No filtrar la URL completa (con query params) a terceros como tile.openstreetmap.org.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app no usa ninguna de estas APIs.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS: 2 años, subdominios incluidos. La cookie de sesión ya es secure;
  // esto evita el primer request en claro.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
