"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPageAction } from "@/app/actions";
import { Input } from "@/components/ui/input";

export function NewPageForm({ projectId, identifier }: { projectId: string; identifier: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createPageAction({ projectId, title });
          if (res.ok) router.push(`/${identifier}/pages/${res.data.id}`);
          else setError(res.error);
        });
      }}
    >
      <Input aria-label="Título de la nueva página" placeholder="Título de la nueva página" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <button disabled={pending || !title.trim()} className="h-8 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
        Crear página
      </button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
