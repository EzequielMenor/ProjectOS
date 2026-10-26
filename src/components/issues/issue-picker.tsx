"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { StateIcon } from "@/lib/issue-meta";
import { cn } from "@/lib/utils";
import type { StateGroup } from "@/db/schema";

export type IssueOption = { id: string; key: string; title: string; stateGroup: StateGroup; stateColor: string };

/** Searchable picker over the project's issues (by key or title). */
export function IssuePicker({
  issues,
  onPick,
  title,
  children,
  className,
}: {
  issues: IssueOption[];
  onPick: (issue: IssueOption) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={title}
        title={title}
        className={cn("inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60", className)}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0">
        <Command>
          <CommandInput placeholder={`${title}…`} />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            {issues.map((i) => (
              <CommandItem
                key={i.id}
                value={`${i.key} ${i.title}`}
                onSelect={() => {
                  setOpen(false);
                  onPick(i);
                }}
              >
                <StateIcon group={i.stateGroup} color={i.stateColor} />
                <span className="font-mono text-xs text-muted-foreground">{i.key}</span>
                <span className="truncate">{i.title}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
