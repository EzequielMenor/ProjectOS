import { cookies } from "next/headers";
import { isDemoMode } from "@/db/client";
import { UI_SIZE_COOKIE, parseUiSize } from "@/lib/ui-scale";
import { listProjects } from "@/server/services/projects";
import { listAllViews } from "@/server/services/views";
import { DemoBanner } from "@/components/demo-banner";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [projects, views] = await Promise.all([listProjects(), listAllViews()]);
  const savedViews = views.map((v) => ({ id: v.id, projectId: v.projectId, name: v.name, layout: v.layout, query: v.query }));
  const uiSize = parseUiSize((await cookies()).get(UI_SIZE_COOKIE)?.value);
  const demo = isDemoMode();
  return (
    <div className="flex h-full flex-col">
      {demo ? <DemoBanner /> : null}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:text-primary-foreground"
        >
          Saltar al contenido
        </a>
        <Sidebar demo={demo} uiSize={uiSize} views={savedViews} projects={projects.map((p) => ({ id: p.id, identifier: p.identifier, name: p.name, color: p.color }))} />
        <CommandPalette
          views={savedViews.map((v) => ({ id: v.id, name: v.name, layout: v.layout, query: v.query, projectId: v.projectId }))}
          projects={projects.map((p) => ({ id: p.id, identifier: p.identifier, name: p.name, color: p.color }))}
        />
        <main id="main" tabIndex={-1} className="min-h-0 min-w-0 flex-1 outline-none bg-background">{children}</main>
      </div>
    </div>
  );
}
