import { PlanningList } from "@/components/planning/planning-list";
import { loadProject } from "@/lib/project-page";
import { listMilestones } from "@/server/services/planning";

export const metadata = { title: "Hitos" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ project: string }> }) {
  const project = await loadProject(params);
  const rows = await listMilestones(project.id);
  return (
    <PlanningList
      kind="milestone"
      projectId={project.id}
      items={rows.map((m) => ({ id: m.id, name: m.name, description: m.description, from: null, to: m.targetDate, progress: m.progress }))}
    />
  );
}
