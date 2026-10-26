import { notFound } from "next/navigation";
import { IssueDetail } from "@/components/issues/issue-detail";
import { ServiceError } from "@/server/errors";
import { toMemberDTO, toPropertyDTO, toStateDTO } from "@/server/dto";
import { listMembers } from "@/server/services/workspace";
import { listPropertyDefs } from "@/server/services/properties";
import { getIssueByKey, listActivity, listIssues } from "@/server/services/issues";
import { pagesMentioningIssue } from "@/server/services/pages";
import { listLabels } from "@/server/services/labels";
import { listRelations } from "@/server/services/work";
import { listCycles, listMilestones, listModules } from "@/server/services/planning";
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
  const [states, activity, cycles, modules, milestones, labels, relations, siblings, mentions, propertyDefs, members] = await Promise.all([
    listStates(issue.projectId),
    listActivity(issue.id),
    listCycles(issue.projectId),
    listModules(issue.projectId),
    listMilestones(issue.projectId),
    listLabels(issue.projectId),
    listRelations(issue.id),
    listIssues({ projectId: issue.projectId, limit: 500 }),
    pagesMentioningIssue(issue.id),
    listPropertyDefs(issue.projectId),
    listMembers(),
  ]);
  const stateName = new Map(states.map((s) => [s.id, s.name]));
  return (
    <IssueDetail
      key={issue.id}
      issue={{
        id: issue.id,
        key: `${issue.project.identifier}-${issue.seq}`,
        type: issue.type,
        title: issue.title,
        description: issue.description,
        stateId: issue.stateId,
        priority: issue.priority,
        assigneeId: issue.assigneeId,
        cycleId: issue.cycleId,
        milestoneId: issue.milestoneId,
        moduleIds: issue.modules.map((m) => m.moduleId),
        projectId: issue.projectId,
        labelIds: issue.labels.map((l) => l.labelId),
        dueDate: issue.dueDate,
        estimate: issue.estimate,
        properties: Object.fromEntries(issue.propertyValues.map((v) => [v.propertyId, v.value])),
        parent: issue.parent ? { id: issue.parent.id, key: `${issue.project.identifier}-${issue.parent.seq}`, title: issue.parent.title } : null,
        children: issue.children.map((c) => ({ id: c.id, key: `${issue.project.identifier}-${c.seq}`, title: c.title, stateGroup: c.state.group, stateColor: c.state.color })),
        relations: relations.map((r) => ({ type: r.type, id: r.id, key: r.key, title: r.title, stateGroup: r.stateGroup })),
        projectIdentifier: issue.project.identifier,
        projectName: issue.project.name,
        createdAt: issue.createdAt.toISOString(),
        comments: issue.comments.map((c) => ({ id: c.id, actor: c.actor, body: c.body, createdAt: c.createdAt.toISOString() })),
        links: issue.links.map((l) => ({ id: l.id, kind: l.kind, url: l.url, title: l.title })),
      }}
      states={states.map(toStateDTO)}
      propertyDefs={propertyDefs.map(toPropertyDTO)}
      members={members.map(toMemberDTO)}
      mentions={mentions.map((p) => ({ id: p.id, title: p.title, identifier: p.identifier }))}
      labels={labels.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
      candidates={siblings
        .filter((i) => i.id !== issue.id)
        .map((i) => ({ id: i.id, key: `${issue.project.identifier}-${i.seq}`, title: i.title, stateGroup: i.state.group, stateColor: i.state.color }))}
      planning={{
        cycles: cycles.map((c) => ({ id: c.id, name: c.name })),
        modules: modules.map((m) => ({ id: m.id, name: m.name })),
        milestones: milestones.map((m) => ({ id: m.id, name: m.name })),
      }}
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
