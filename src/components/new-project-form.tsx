"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createProjectAction } from "@/app/actions";
import { Input } from "@/components/ui/input";

const suggest = (name: string) => name.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createProjectAction({ name, identifier: identifier || suggest(name) });
          if (res.ok) router.push(`/${res.data.identifier}/list`);
          else setError(res.error);
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        Nombre
        <Input
          autoFocus
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!touched) setIdentifier(suggest(e.target.value));
          }}
          placeholder="Fichaje"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Identificador
        <Input
          required
          value={identifier}
          onChange={(e) => {
            setTouched(true);
            setIdentifier(e.target.value.toUpperCase());
          }}
          placeholder="FICH"
          className="font-mono uppercase"
          maxLength={10}
        />
      </label>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <button
        disabled={pending || !name.trim()}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creando…" : "Crear proyecto"}
      </button>
    </form>
  );
}
