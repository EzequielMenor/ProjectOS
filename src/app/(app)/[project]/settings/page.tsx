import { ProjectSettings } from "@/components/project-settings";
import { loadProject } from "@/lib/project-page";
import { listStates } from "@/server/services/projects";
import { stateIssueCounts } from "@/server/services/states";

export const metadata = { title: "Ajustes del proyecto" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ project: string }> }) {
  const project = await loadProject(params);
  const [states, counts] = await Promise.all([listStates(project.id), stateIssueCounts(project.id)]);
  return (
    <ProjectSettings
      project={{ id: project.id, identifier: project.identifier, name: project.name, description: project.description, color: project.color }}
      states={states.map((s) => ({ id: s.id, name: s.name, group: s.group, color: s.color, isDefault: !!s.isDefault, issues: counts[s.id] ?? 0 }))}
    />
  );
}
