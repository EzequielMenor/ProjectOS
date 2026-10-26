import { listProjects } from "@/server/services/projects";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const projects = await listProjects();
  return (
    <div className="flex h-full">
      <Sidebar projects={projects.map((p) => ({ id: p.id, identifier: p.identifier, name: p.name, color: p.color }))} />
      <main id="main" className="min-w-0 flex-1 bg-background">{children}</main>
    </div>
  );
}
