import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemberDTO } from "@/server/dto";

/** Initial for people, a bot glyph for agents. Stands alone as an image named after the member, or `decorative` next to their written name. */
export function MemberAvatar({ member, className, decorative }: { member: Pick<MemberDTO, "name" | "kind">; className?: string; decorative?: boolean }) {
  return (
    <span
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": member.name, title: member.name })}
      className={cn(
        "inline-grid size-5 shrink-0 place-items-center text-[0.6875rem] font-medium",
        member.kind === "agent" ? "rounded-md bg-primary/15 text-primary" : "rounded-full bg-muted text-muted-foreground",
        className,
      )}
    >
      {member.kind === "agent" ? <Bot className="size-3.5" aria-hidden /> : member.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
