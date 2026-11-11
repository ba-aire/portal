"use client";

import { usePathname } from "next/navigation";
import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn, splitPathName } from "@/lib/utils";

// Segmentos de la URL que no se muestran con la mayúscula inicial de siempre:
// "ica" es una sigla.
const ETIQUETAS: Record<string, string> = { ica: "ICA" };

export function AppBreadCrumb() {
  const pathName = usePathname();
  const partesRuta = splitPathName(pathName);

  return (
    <Breadcrumb className={cn("flex items-center ml-5")}>
      <BreadcrumbList>
        {partesRuta.map((parte, index) => (
          <React.Fragment key={partesRuta.slice(0, index + 1).join("/")}>
            <BreadcrumbItem>
              <BreadcrumbLink
                // href={`/${parte}`}
                className={cn(
                  "font-medium text-primary hover:text-secondary cursor-pointer select-none",
                )}
              >
                {ETIQUETAS[parte]
                  ? ETIQUETAS[parte]
                  : parte.includes("-")
                    ? parte
                        .split("-")
                        .map(
                          (word) =>
                            word.charAt(0).toUpperCase() + word.slice(1),
                        )
                        .join(" ")
                    : parte.charAt(0).toUpperCase() + parte.slice(1)}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {partesRuta.length > index + 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
