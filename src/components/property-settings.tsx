"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { createPropertyAction, deletePropertyAction, updatePropertyAction, type ActionResult } from "@/app/actions";
import { Input } from "@/components/ui/input";
import type { PropertyType } from "@/db/schema";

export type PropertyRow = { id: string; name: string; type: PropertyType; options: string[]; issues: number };
type Run = (fn: () => Promise<ActionResult<unknown>>, ok?: string) => void;

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = { text: "Texto", number: "Número", date: "Fecha", select: "Selección" };

const selectClass = "h-8 rounded-md border bg-background px-2 text-sm";
const primaryBtn = "h-8 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50";

const splitOptions = (v: string) => v.split(",").map((o) => o.trim()).filter(Boolean);

export function PropertySettings({ projectId, properties, run }: { projectId: string; properties: PropertyRow[]; run: Run }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("text");
  const [options, setOptions] = useState("");
  return (
    <section aria-label="Propiedades personalizadas" className="mt-10">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Propiedades personalizadas</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Campos propios de este proyecto (texto, número, fecha o selección). Aparecen en la ficha y en la tabla; las de selección también como filtro. Los agentes
        las leen y escriben por nombre.
      </p>
      {properties.length ? (
        <ul className="mt-3 divide-y rounded-lg border">
          {properties.map((p) => (
            <PropertyItem key={`${p.id}:${p.name}:${p.options.join("|")}`} p={p} run={run} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">Aún no hay propiedades. Crea la primera aquí abajo.</p>
      )}
      <form
        aria-label="Nueva propiedad"
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const res = await createPropertyAction({ projectId, name, type, options: type === "select" ? splitOptions(options) : undefined });
            if (res.ok) {
              setName("");
              setOptions("");
            }
            return res;
          });
        }}
      >
        <Input aria-label="Nombre de la nueva propiedad" placeholder="Nueva propiedad" value={name} onChange={(e) => setName(e.target.value)} className="min-w-40 flex-1" required />
        <select aria-label="Tipo de la nueva propiedad" value={type} onChange={(e) => setType(e.target.value as PropertyType)} className={selectClass}>
          {(Object.keys(PROPERTY_TYPE_LABEL) as PropertyType[]).map((t) => (
            <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>
          ))}
        </select>
        {type === "select" ? (
          <Input aria-label="Opciones de la nueva propiedad" placeholder="Opciones separadas por comas" value={options} onChange={(e) => setOptions(e.target.value)} className="min-w-52 flex-1" />
        ) : null}
        <button disabled={!name.trim() || (type === "select" && !splitOptions(options).length)} className={primaryBtn}>Añadir</button>
      </form>
    </section>
  );
}

function PropertyItem({ p, run }: { p: PropertyRow; run: Run }) {
  const [name, setName] = useState(p.name);
  const [options, setOptions] = useState(p.options.join(", "));
  const [confirming, setConfirming] = useState(false);
  const patch = (body: Record<string, unknown>) => run(() => updatePropertyAction(p.id, body));
  return (
    <li data-testid="property-row" className="flex flex-col gap-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={`Nombre de ${p.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== p.name) patch({ name });
            else setName(p.name);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="h-7 min-w-40 flex-1"
        />
        <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground" title="El tipo no se puede cambiar">{PROPERTY_TYPE_LABEL[p.type]}</span>
        <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{p.issues} {p.issues === 1 ? "issue" : "issues"}</span>
        <button type="button" aria-label={`Borrar ${p.name}`} onClick={() => setConfirming((v) => !v)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {p.type === "select" ? (
        <Input
          aria-label={`Opciones de ${p.name}`}
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          onBlur={() => {
            const next = splitOptions(options);
            if (next.join("\u0000") !== p.options.join("\u0000")) patch({ options: next });
            else setOptions(p.options.join(", "));
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="Opciones separadas por comas"
          className="h-7"
        />
      ) : null}
      {confirming ? (
        <div role="group" aria-label={`Borrar ${p.name}`} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm">
          <span>
            {p.issues
              ? `Se borrará «${p.name}» y su valor en ${p.issues} ${p.issues === 1 ? "issue" : "issues"}. Solo se recupera restaurando una copia de seguridad.`
              : `Se borrará «${p.name}». Ningún issue tiene valor.`}
          </span>
          <button
            type="button"
            onClick={() =>
              run(async () => {
                const res = await deletePropertyAction(p.id);
                if (res.ok) setConfirming(false);
                return res;
              })
            }
            className="h-7 rounded-md bg-destructive px-2.5 text-xs font-medium text-white"
          >
            Borrar propiedad
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent">Cancelar</button>
        </div>
      ) : null}
    </li>
  );
}
