import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Rezervo – online rezervace pro malé podniky",
    template: "%s | Rezervo",
  },
  description:
    "Jednoduchý rezervační systém pro kadeřnictví, fyzioterapie a masáže. Zákazníci si rezervují termín online, vy máte přehled v kalendáři.",
};

export const viewport: Viewport = {
  themeColor: "#faf8f5",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="cs" className={`${jakarta.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="skip-link">
          Přeskočit na obsah
        </a>
        {children}
      </body>
    </html>
  );
}
