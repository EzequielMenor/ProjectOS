import { PlanningList } from "@/components/planning/planning-list";
import { loadProject } from "@/lib/project-page";
import { listModules } from "@/server/services/planning";

export const metadata = { title: "Módulos" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ project: string }> }) {
  const project = await loadProject(params);
  const rows = await listModules(project.id);
  return (
    <PlanningList
      kind="module"
      projectId={project.id}
      items={rows.map((c) => ({ id: c.id, name: c.name, description: c.description, from: c.startDate, to: c.targetDate, status: c.status, progress: c.progress }))}
    />
  );
}
