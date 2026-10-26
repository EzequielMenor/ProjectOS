import { PlanningList } from "@/components/planning/planning-list";
import { loadProject } from "@/lib/project-page";
import { listCycles } from "@/server/services/planning";

export const metadata = { title: "Ciclos" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ project: string }> }) {
  const project = await loadProject(params);
  const rows = await listCycles(project.id);
  return (
    <PlanningList
      kind="cycle"
      projectId={project.id}
      items={rows.map((c) => ({ id: c.id, name: c.name, description: c.description, from: c.startDate, to: c.endDate, progress: c.progress }))}
    />
  );
}
