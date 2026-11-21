"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface Item {
  title: string;
  url: string;
}
interface ModuleMenuProps {
  title: string;
  icon: LucideIcon;
  items: Array<Item>;
}

// El título abre y cierra el grupo; cada subítem es un link de verdad (se llega
// con Tab y se abre en otra pestaña).
export function MenuSub({ title, items, icon: Icon }: ModuleMenuProps) {
  const [isOpen, setIsOpen] = useState(true);
  const pathName = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Collapsible
          defaultOpen
          onOpenChange={(open) => setIsOpen(open)}
          className="group/collapsible"
        >
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={title}>
              <Icon />
              <span>{title}</span>
              <ChevronRight
                className={`ml-auto transition-transform ${
                  isOpen ? "rotate-90" : "rotate-0"
                }`}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <SidebarMenuSub>
            {items.map((item) => (
              <CollapsibleContent
                key={item.title}
                className={`transition-[max-height] ease-in-out duration-300 ${
                  isOpen ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    asChild
                    isActive={pathName === item.url}
                  >
                    <Link
                      href={item.url}
                      aria-current={pathName === item.url ? "page" : undefined}
                      onClick={() => setOpenMobile(false)}
                    >
                      {item.title}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </CollapsibleContent>
            ))}
          </SidebarMenuSub>
        </Collapsible>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
