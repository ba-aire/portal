"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface Item {
  title: string;
  url: string;
  icon: LucideIcon;
}
interface ModuleMenuProps {
  items: Array<Item>;
}

// Cada ítem es un link de verdad (no un botón con router.push): se llega con
// Tab, se abre en otra pestaña y el lector de pantalla lo anuncia como link.
export function Menu({ items }: ModuleMenuProps) {
  const pathName = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {items.map((item) => (
          <SidebarMenuButton
            key={item.title}
            asChild
            tooltip={item.title}
            isActive={pathName === item.url}
          >
            {/* aria-label: con el menú plegado el texto se oculta y el link
                quedaría sin nombre para el lector de pantalla. */}
            <Link
              href={item.url}
              aria-label={item.title}
              aria-current={pathName === item.url ? "page" : undefined}
              onClick={() => setOpenMobile(false)}
            >
              <item.icon className="z-50" />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        ))}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
