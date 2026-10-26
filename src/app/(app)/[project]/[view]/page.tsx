import { notFound } from "next/navigation";
import { IssueWorkspace } from "@/components/issues/issue-workspace";
import { toIssueDTO, toPropertyDTO, toStateDTO } from "@/server/dto";
import { listPropertyDefs } from "@/server/services/properties";
import { listLabels } from "@/server/services/labels";
import { listCycles, listModules } from "@/server/services/planning";
import { listViews } from "@/server/services/views";
import { listIssues } from "@/server/services/issues";
import { getProjectByIdentifier, listStates } from "@/server/services/projects";
import { ServiceError } from "@/server/errors";

export async function generateMetadata({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  return { title: project.toUpperCase() };
}

export default async function ProjectViewPage({
  params,
}: {
  params: Promise<{ project: string; view: string }>;
}) {
  const { project: key, view } = await params;
  if (view !== "list" && view !== "board" && view !== "table") notFound();
  const project = await getProjectByIdentifier(key).catch((e) => {
    if (e instanceof ServiceError && e.code === "not_found") notFound();
    throw e;
  });
  const [states, issues, labels, cycles, modules, views, properties] = await Promise.all([
    listStates(project.id),
    listIssues({ projectId: project.id }),
    listLabels(project.id),
    listCycles(project.id),
    listModules(project.id),
    listViews(project.id),
    listPropertyDefs(project.id),
  ]);
  return (
    <IssueWorkspace
      key={project.id}
      view={view}
      project={{ id: project.id, identifier: project.identifier, name: project.name }}
      states={states.map(toStateDTO)}
      labels={labels.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
      cycles={cycles.map((c) => ({ id: c.id, name: c.name }))}
      modules={modules.map((m) => ({ id: m.id, name: m.name }))}
      properties={properties.map(toPropertyDTO)}
      views={views.map((v) => ({ id: v.id, name: v.name, layout: v.layout, query: v.query }))}
      initialIssues={issues.map((i) => toIssueDTO(i, project.identifier))}
    />
  );
}
