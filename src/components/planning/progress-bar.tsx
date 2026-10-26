import type { Progress } from "@/server/services/planning";

export const percent = (p: Progress) => {
  const live = p.total - p.cancelled;
  return live > 0 ? Math.round((p.completed / live) * 100) : 0;
};

export function ProgressBar({ progress }: { progress: Progress }) {
  const live = Math.max(progress.total - progress.cancelled, 1);
  const done = (progress.completed / live) * 100;
  const active = (progress.started / live) * 100;
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={percent(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso"
        className="flex h-1.5 w-28 overflow-hidden rounded-full bg-muted"
      >
        <div className="bg-emerald-500" style={{ width: `${done}%` }} />
        <div className="bg-amber-400" style={{ width: `${active}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {progress.completed}/{progress.total - progress.cancelled} · {percent(progress)}%
      </span>
    </div>
  );
}
