"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTokenAction, revokeTokenAction } from "@/app/actions";
import { AgentSetup } from "@/components/agent-setup";
import { Input } from "@/components/ui/input";

type Tok = { id: string; name: string; scope: "read" | "write"; createdAt: string; lastUsedAt: string | null; revoked: boolean };
const fmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

export function TokensPanel({ tokens }: { tokens: Tok[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("write");
  const [fresh, setFresh] = useState<{ token: string; scope: "read" | "write" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-6 flex flex-col gap-6">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const res = await createTokenAction({ name, scope });
            if (res.ok) {
              setFresh({ token: res.data.token, scope });
              setName("");
              router.refresh();
            } else setError(res.error);
          });
        }}
      >
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          Nombre
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="claude-code" required />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Permiso
          <select
            aria-label="Permiso"
            value={scope}
            onChange={(e) => setScope(e.target.value as "read" | "write")}
            className="h-8 rounded-lg border bg-transparent px-2 text-sm"
          >
            <option value="write">write</option>
            <option value="read">read</option>
          </select>
        </label>
        <button disabled={pending || !name.trim()} className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Crear token
        </button>
      </form>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {fresh ? (
        <div role="status" className="rounded-lg border bg-card p-4 text-sm">
          <p className="font-medium">Copia el token ahora: no se volverá a mostrar.</p>
          <code data-testid="new-token" className="mt-2 block break-all rounded bg-muted p-2 font-mono text-xs">{fresh.token}</code>
        </div>
      ) : null}

      <AgentSetup token={fresh?.token ?? null} scope={fresh?.scope ?? scope} />

      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr><th className="py-2 font-medium">Nombre</th><th className="font-medium">Permiso</th><th className="font-medium">Último uso</th><th /></tr>
        </thead>
        <tbody>
          {tokens.length === 0 ? (
            <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Aún no hay tokens.</td></tr>
          ) : null}
          {tokens.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="py-2">{t.name}</td>
              <td className="font-mono text-xs">{t.scope}</td>
              <td className="text-xs text-muted-foreground">{t.revoked ? "revocado" : t.lastUsedAt ? fmt.format(new Date(t.lastUsedAt)) : "nunca"}</td>
              <td className="text-right">
                {t.revoked ? null : (
                  <button
                    onClick={() => start(async () => { await revokeTokenAction(t.id); router.refresh(); })}
                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-destructive"
                  >
                    Revocar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
