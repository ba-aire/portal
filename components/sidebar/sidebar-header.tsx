"use client";

import {
  SidebarHeader,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import balogo from "../../public/BA-primary.png";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export function Header() {
  const { open } = useSidebar();

  return (
    <SidebarHeader className="my-5">
      {/* Es la marca, no un botón: asChild con un div para que no se pueda
          enfocar ni "apretar" sin que haga nada. */}
      <SidebarMenuButton
        asChild
        size="lg"
        className="hover:bg-sidebar active:bg-sidebar hover:text-white active:text-white cursor-default"
      >
        <div>
          <Avatar className={open ? "h-10 w-10 rounded-sm" : "h-8 w-8"}>
            <AvatarImage
              src={balogo.src}
              alt="Buenos Aires Ciudad"
              className={cn("bg-accent")}
            />
            <AvatarFallback>BA</AvatarFallback>
          </Avatar>
          <div
            className={`flex flex-col ml-2 text-primary-foreground transition-transform ${open ? "delay-300 translate-y-0 opacity-100" : "opacity-0 -translate-y-40"}`}
          >
            <p className="font-bold text-sm">APrA</p>
            <p className="text-xs">Red de Calidad del Aire</p>
          </div>
        </div>
      </SidebarMenuButton>
    </SidebarHeader>
  );
}
