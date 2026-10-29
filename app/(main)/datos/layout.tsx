import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BA Aire - Explorar datos",
};

export default function DatosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
