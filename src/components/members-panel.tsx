"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMemberAction, deleteMemberAction, renameMemberAction, type ActionResult } from "@/app/actions";
import { MemberAvatar } from "@/components/member-avatar";
import { Input } from "@/components/ui/input";

type Row = { id: string; name: string; kind: "human" | "agent"; issues: number };

const selectClass = "h-8 rounded-md border bg-background px-2 text-sm";

export function MembersPanel({ members }: { members: Row[] }) {
  const [, start] = useTransition();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"human" | "agent">("human");
  const run = (fn: () => Promise<ActionResult<unknown>>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else if (ok) toast.success(ok);
    });

  return (
    <section aria-label="Miembros" className="mt-6">
      <ul className="divide-y rounded-lg border">
        {members.map((m) => (
          <MemberItem key={`${m.id}:${m.name}`} m={m} run={run} />
        ))}
        {members.length === 0 ? <li className="px-3 py-4 text-center text-sm text-muted-foreground">Aún no hay miembros.</li> : null}
      </ul>
      <form
        aria-label="Nuevo miembro"
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const res = await createMemberAction({ name, kind });
            if (res.ok) setName("");
            return res;
          });
        }}
      >
        <Input aria-label="Nombre del nuevo miembro" placeholder="Nuevo miembro" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required />
        <select aria-label="Tipo del nuevo miembro" value={kind} onChange={(e) => setKind(e.target.value as "human" | "agent")} className={selectClass}>
          <option value="human">Persona</option>
          <option value="agent">Agente</option>
        </select>
        <button disabled={!name.trim()} className="h-8 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Añadir
        </button>
      </form>
    </section>
  );
}

function MemberItem({ m, run }: { m: Row; run: (fn: () => Promise<ActionResult<unknown>>, ok?: string) => void }) {
  const [name, setName] = useState(m.name);
  const [confirming, setConfirming] = useState(false);
  return (
    <li data-testid="member-row" className="flex flex-col gap-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <MemberAvatar member={m} decorative />
        <Input
          aria-label={`Nombre de ${m.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name.trim() !== m.name) run(() => renameMemberAction(m.id, { name }));
            else setName(m.name);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="h-7"
        />
        <span className="shrink-0 rounded-full border px-2 text-xs text-muted-foreground">{m.kind === "agent" ? "Agente" : "Persona"}</span>
        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{m.issues} {m.issues === 1 ? "issue" : "issues"}</span>
        <button type="button" aria-label={`Borrar ${m.name}`} onClick={() => setConfirming((v) => !v)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {confirming ? (
        <div role="group" aria-label={`Confirmar borrado de ${m.name}`} className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm">
          <span>
            Se borrará «{m.name}»{m.issues ? ` y ${m.issues === 1 ? "su issue quedará" : `sus ${m.issues} issues quedarán`} sin asignar` : ""}.
          </span>
          <button
            type="button"
            onClick={() =>
              run(async () => {
                const res = await deleteMemberAction(m.id);
                if (res.ok) setConfirming(false);
                return res;
              })
            }
            className="h-7 rounded-md bg-destructive px-2.5 text-xs font-medium text-white"
          >
            Borrar miembro
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent">
            Cancelar
          </button>
        </div>
      ) : null}
    </li>
  );
}
