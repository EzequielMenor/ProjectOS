import type { Priority, StateGroup } from "@/db/schema";
import { cn } from "@/lib/utils";

export const PRIORITY_LABEL: Record<Priority, string> = {
  none: "Sin prioridad",
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low", "none"];

export const GROUP_LABEL: Record<StateGroup, string> = {
  backlog: "Backlog",
  unstarted: "Sin empezar",
  started: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

/** Circle glyph whose fill communicates the state group (Linear-style progress ring). */
export function StateIcon({ group, color, className }: { group: StateGroup; color: string; className?: string }) {
  const size = 14;
  const r = 5.5;
  const c = 2 * Math.PI * (r / 2);
  const fill = group === "started" ? 0.5 : group === "completed" ? 1 : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={cn("shrink-0", className)} aria-hidden>
      <circle
        cx="7"
        cy="7"
        r={r}
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={group === "backlog" ? "1.6 1.8" : undefined}
      />
      {group === "started" || group === "completed" ? (
        <circle
          cx="7"
          cy="7"
          r={r / 2}
          stroke={color}
          strokeWidth={r}
          strokeDasharray={`${c * fill} ${c}`}
          transform="rotate(-90 7 7)"
        />
      ) : null}
      {group === "completed" ? (
        <path d="M4.6 7.2l1.8 1.8 3-3.4" stroke="var(--background)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {group === "cancelled" ? (
        <path d="M5 5l4 4M9 5l-4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

const BAR_COLOR: Record<Priority, string> = {
  urgent: "var(--destructive)",
  high: "oklch(0.72 0.17 55)",
  medium: "oklch(0.78 0.15 90)",
  low: "oklch(0.7 0.1 230)",
  none: "var(--muted-foreground)",
};

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === "none")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className={cn("shrink-0 opacity-50", className)} aria-hidden>
        <path d="M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  if (priority === "urgent")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className={cn("shrink-0", className)} aria-hidden>
        <rect x="1.5" y="1.5" width="11" height="11" rx="3" fill={BAR_COLOR.urgent} />
        <path d="M7 4v3.6M7 9.6v.1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  const level = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className={cn("shrink-0", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2 + i * 4}
          y={9 - i * 3}
          width="2.6"
          height={3 + i * 3}
          rx="0.8"
          fill={i < level ? BAR_COLOR[priority] : "currentColor"}
          opacity={i < level ? 1 : 0.25}
        />
      ))}
    </svg>
  );
}
