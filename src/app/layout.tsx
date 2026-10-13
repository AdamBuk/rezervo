import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: {
    default: "Rezervo – online rezervace pro malé podniky",
    template: "%s | Rezervo",
  },
  description:
    "Jednoduchý rezervační systém pro kadeřnictví, fyzioterapie a masáže. Zákazníci si rezervují termín online, vy máte přehled v kalendáři.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e13" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The init script sets `dark` / color-scheme on <html> before hydration.
    <html lang="cs" className={`${inter.variable} ${interTight.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="skip-link">
          Přeskočit na obsah
        </a>
        {children}
      </body>
    </html>
  );
}
