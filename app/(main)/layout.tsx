import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppBreadCrumb } from "@/components/app-breadcrumb";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import Loading from "../loading";

export const metadata = {
  title: "BA Aire - Inicio",
  description: "Sistema de Gestion de la Red de Calidad del Aire.",
};

export default async function InicioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // sidebar state
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar:state")?.value === "true";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      {/* min-w-0: sin esto, una tabla ancha (Descargas, Explorar Datos) estira
          el main más allá de la pantalla en vez de scrollear dentro de su caja. */}
      <main className="w-full min-w-0 h-screen p-3">
        <div className="flex flex-col h-full rounded bg-gray-50 shadow-md shadow-black/25 overflow-auto">
          <div className="flex">
            <SidebarTrigger />
            <AppBreadCrumb />
          </div>
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </div>
      </main>
    </SidebarProvider>
  );
}
