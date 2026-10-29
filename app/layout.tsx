// El CSS de MapLibre sale del paquete instalado, no de unpkg.com. Traerlo por CDN
// en runtime deja que un tercero inyecte estilos en toda la app —y el CSS puede
// exfiltrar datos vía selectores de atributo con background-image—, además de
// obligar al CSP a permitir un origen externo en style-src.
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata = {
  title: "SIRCA - Inicio",
  description: "Sistema de Gestion de la Red de Calidad del Aire.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="bg-(--secondary-bg-1) overflow-hidden">
      <body>{children}</body>
    </html>
  );
}
