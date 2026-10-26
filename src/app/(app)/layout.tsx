import { cookies } from "next/headers";
import { UI_SIZE_COOKIE, parseUiSize } from "@/lib/ui-scale";
import { listProjects } from "@/server/services/projects";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const projects = await listProjects();
  const uiSize = parseUiSize((await cookies()).get(UI_SIZE_COOKIE)?.value);
  return (
    <div className="flex h-full flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <Sidebar uiSize={uiSize} projects={projects.map((p) => ({ id: p.id, identifier: p.identifier, name: p.name, color: p.color }))} />
      <CommandPalette projects={projects.map((p) => ({ identifier: p.identifier, name: p.name, color: p.color }))} />
      <main id="main" tabIndex={-1} className="min-h-0 min-w-0 flex-1 outline-none bg-background">{children}</main>
    </div>
  );
}
