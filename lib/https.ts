// El portal se sirve por HTTP plano dentro de la VPN, igual que las demás apps
// internas del organismo (ver ADR 0017 en ba-aire/infra). La VPN cifra el tramo
// del dispositivo al FortiGate; de ahí a la VM el tráfico va en claro.
//
// PORTAL_HTTPS=true vuelve a prender lo que solo tiene sentido con TLS adelante:
// - la cookie de sesión `secure`, que el navegador NO guarda si la página es http
//   (con secure por HTTP, el login "funciona" pero nadie queda logueado);
// - `upgrade-insecure-requests` en el CSP, que por HTTP haría pedir cada JS y CSS
//   por https y dejaría la página en blanco.
// HSTS no depende de esto: si vuelve el HTTPS, hay que agregarlo a mano en
// next.config.mjs.
//
// Se lee en cada llamada y no al cargar el módulo, para que los tests puedan
// cambiarlo.
export function isHttps(): boolean {
  return process.env.PORTAL_HTTPS === "true";
}
