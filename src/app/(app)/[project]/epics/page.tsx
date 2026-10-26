import { EpicList } from "@/components/epics/epic-list";
import { loadProject } from "@/lib/project-page";
import { listEpics } from "@/server/services/epics";

export const metadata = { title: "Épicas" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ project: string }> }) {
  const project = await loadProject(params);
  const epics = await listEpics(project.id);
  return (
    <EpicList
      projectId={project.id}
      identifier={project.identifier}
      epics={epics.map((e) => ({ ...e, seq: Number(e.key.split("-").pop()) }))}
    />
  );
}
