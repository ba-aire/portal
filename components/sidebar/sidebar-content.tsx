"use client";

import {
  datos,
  descargas,
  estaciones,
  ica,
  reportes,
} from "@/components/sidebar/items";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Menu } from "./sidebar-menu";
import { MenuSub } from "./sidebar-menu-sub";

export function Content() {
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Tiempo Real</SidebarGroupLabel>
        <Menu items={ica} />
        <MenuSub
          title={estaciones.title}
          items={estaciones.items}
          icon={estaciones.icon}
        />
        <SidebarGroupLabel>Datos Históricos</SidebarGroupLabel>
        <Menu items={datos} />
        <Menu items={reportes} />
        <Menu items={descargas} />
      </SidebarGroup>
    </SidebarContent>
  );
}
