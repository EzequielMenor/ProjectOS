import { MembersPanel } from "@/components/members-panel";
import { listMembersWithCounts } from "@/server/services/members";

export const metadata = { title: "Miembros" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const members = await listMembersWithCounts();
  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto px-6 py-10">
      <h1 className="text-lg font-semibold tracking-tight">Miembros</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Personas y agentes a los que se pueden asignar issues. Los agentes los ven y asignan por nombre (<code className="font-mono text-xs">list_members</code>, <code className="font-mono text-xs">assignee</code>), pero no pueden borrarlos.
      </p>
      <MembersPanel members={members.map((m) => ({ id: m.id, name: m.name, kind: m.kind, issues: m.issues }))} />
    </div>
  );
}
