import { notFound } from "next/navigation";
import { PageEditor } from "@/components/pages/page-editor";
import { loadProject } from "@/lib/project-page";
import { ServiceError } from "@/server/errors";
import { getPage, listPageVersions, pageLinks, resolveContent } from "@/server/services/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ project: string; id: string }> }) {
  const { id } = await params;
  const p = await getPage(id).catch(() => null);
  return { title: p?.title ?? "Página" };
}

export default async function Page({ params }: { params: Promise<{ project: string; id: string }> }) {
  const project = await loadProject(params);
  const { id } = await params;
  const pg = await getPage(id).catch((e) => {
    if (e instanceof ServiceError && e.code === "not_found") notFound();
    throw e;
  });
  if (pg.projectId !== project.id) notFound();
  const [links, versions, resolved] = await Promise.all([pageLinks(pg.id), listPageVersions(pg.id), resolveContent(pg.projectId, pg.content)]);
  return (
    <PageEditor
      key={pg.id}
      identifier={project.identifier}
      projectName={project.name}
      page={{ id: pg.id, title: pg.title, content: pg.content, updatedAt: pg.updatedAt.toISOString(), archived: !!pg.archivedAt }}
      resolved={resolved}
      links={{
        issues: links.issues.map((i) => ({ key: `${i.identifier}-${i.seq}`, identifier: i.identifier, seq: i.seq, title: i.title })),
        outgoing: links.outgoing.map((p) => ({ id: p.id, title: p.title })),
        backlinks: links.backlinks.map((p) => ({ id: p.id, title: p.title })),
      }}
      versions={versions.map((v) => ({ id: v.id, title: v.title, actor: v.actor, createdAt: v.createdAt.toISOString(), chars: v.content.length }))}
    />
  );
}
