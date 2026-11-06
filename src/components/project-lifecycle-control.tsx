"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProjectAction } from "@/app/actions";
import type { ProjectStatus } from "@/db/schema";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_ORDER, UNCLASSIFIED_LABEL, statusLabel } from "@/lib/project-status";

/**
 * Lifecycle selector shared by the portfolio rows and the project settings. It only ever sends `status`, so it never
 * touches name, color or description. Parents should key it by the saved status so it follows server updates.
 */
export function ProjectLifecycleControl({ projectId, projectName, status }: { projectId: string; projectName: string; status: ProjectStatus | null }) {
  const [value, setValue] = useState<ProjectStatus | null>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const change = (next: ProjectStatus | null) => {
    setValue(next);
    setError(null);
    start(async () => {
      const res = await updateProjectAction(projectId, { status: next });
      if (res.ok) {
        toast.success(`${projectName}: ${statusLabel(next)}`);
      } else {
        setValue(status);
        setError(res.error);
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <select
        aria-label={`Estado de ${projectName}`}
        aria-invalid={error ? true : undefined}
        value={value ?? ""}
        disabled={pending}
        onChange={(e) => change((e.target.value || null) as ProjectStatus | null)}
        className="h-8 max-w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <option value="">{UNCLASSIFIED_LABEL}</option>
        {PROJECT_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
        ))}
      </select>
      <span role="status" className="text-xs text-muted-foreground empty:hidden">{pending ? "Guardando…" : null}</span>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
