import { notFound } from "next/navigation";
import { IssueDetail } from "@/components/issues/issue-detail";
import { ServiceError } from "@/server/errors";
import { toStateDTO } from "@/server/dto";
import { getIssueByKey, listActivity } from "@/server/services/issues";
import { listStates } from "@/server/services/projects";

export async function generateMetadata({ params }: { params: Promise<{ project: string; seq: string }> }) {
  const { project, seq } = await params;
  return { title: `${project.toUpperCase()}-${seq}` };
}

export default async function IssuePage({ params }: { params: Promise<{ project: string; seq: string }> }) {
  const { project, seq } = await params;
  const issue = await getIssueByKey(`${project}-${seq}`).catch((e) => {
    if (e instanceof ServiceError && (e.code === "not_found" || e.code === "invalid")) notFound();
    throw e;
  });
  const [states, activity] = await Promise.all([listStates(issue.projectId), listActivity(issue.id)]);
  const stateName = new Map(states.map((s) => [s.id, s.name]));
  return (
    <IssueDetail
      key={issue.id + issue.updatedAt.getTime()}
      issue={{
        id: issue.id,
        key: `${issue.project.identifier}-${issue.seq}`,
        title: issue.title,
        description: issue.description,
        stateId: issue.stateId,
        priority: issue.priority,
        projectIdentifier: issue.project.identifier,
        projectName: issue.project.name,
        createdAt: issue.createdAt.toISOString(),
        comments: issue.comments.map((c) => ({ id: c.id, actor: c.actor, body: c.body, createdAt: c.createdAt.toISOString() })),
        links: issue.links.map((l) => ({ id: l.id, kind: l.kind, url: l.url, title: l.title })),
      }}
      states={states.map(toStateDTO)}
      activity={activity.map((a) => ({
        id: a.id,
        actor: a.actor,
        action: a.action,
        createdAt: a.createdAt.toISOString(),
        data: JSON.parse(JSON.stringify(a.data, (_k, v) => (typeof v === "string" && stateName.has(v) ? stateName.get(v) : v))),
      }))}
    />
  );
}
