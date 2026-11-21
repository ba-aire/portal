"use server";

import { ChevronUp, LogOutIcon, PlusIcon, UserPenIcon } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/actions/auth/";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { verifySession } from "@/lib/auth-session";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";

interface CookieResponse {
  isAuth: boolean;
  data: {
    userId: string;
    userName: string;
    email: string;
    role: string;
  };
}

// Iniciales del nombre ("Admin Dev" -> "AD"), armadas acá: el avatar no se
// pide a ningún servicio externo, que recibiría el correo de cada usuario.
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return letras.join("") || "?";
}

export async function Footer() {
  // user cookie sesion data
  const cookie: CookieResponse = await verifySession();
  const userName = cookie.data.userName;
  const userRole = cookie.data.role;

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size={"lg"}>
                  <Avatar className="h-7 w-7 rounded-lg" aria-hidden>
                    <AvatarFallback className="rounded-lg bg-secondary text-primary text-xs font-bold">
                      {iniciales(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-bold text-base">{userName}</p>
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-(--radix-popper-anchor-width)"
              >
                <DropdownMenuItem>
                  <UserPenIcon />
                  <span>Mi Perfil</span>
                </DropdownMenuItem>
                {userRole === "ADMIN" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <PlusIcon />
                      <span>Registrar Usuario</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DialogTrigger className="w-full">
                  <DropdownMenuItem>
                    <LogOutIcon />
                    <span>Salir</span>
                  </DropdownMenuItem>
                </DialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>¿Estas seguro?</DialogTitle>
                <DialogDescription>
                  Presiona salir para cerrar la sesión, o cualquier parte de la
                  pantalla para continuar trabajando
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="destructive" onClick={logout}>
                  Salir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
