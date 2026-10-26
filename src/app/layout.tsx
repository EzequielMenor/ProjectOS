import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { UI_SIZE_COOKIE, parseUiSize } from "@/lib/ui-scale";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ProjectOS", template: "%s · ProjectOS" },
  description: "Gestión de proyectos local-first para equipos y agentes.",
};

// All pages read live data from the database.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const size = parseUiSize((await cookies()).get(UI_SIZE_COOKIE)?.value);
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full`} style={{ fontSize: `${size}px` }} suppressHydrationWarning>
      <body className="h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delay={300}>{children}</TooltipProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
