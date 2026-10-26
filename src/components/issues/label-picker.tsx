"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type LabelOption = { id: string; name: string; color: string };

/** Multi-select labels; typing a name that does not exist offers to create it. */
export function LabelPicker({
  labels,
  selected,
  onToggle,
  onCreate,
  children,
  className,
}: {
  labels: LabelOption[];
  selected: string[];
  onToggle: (id: string) => void;
  onCreate: (name: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const exists = labels.some((l) => l.name.toLowerCase() === q.toLowerCase());
  return (
    <Popover onOpenChange={(o) => !o && setQuery("")}>
      <PopoverTrigger
        aria-label="Etiquetas"
        title="Etiquetas"
        className={cn("inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent", className)}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-0 p-0">
        <Command>
          <CommandInput placeholder="Etiquetas…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{q ? "Sin coincidencias" : "Aún no hay etiquetas"}</CommandEmpty>
            <CommandGroup>
              {labels.map((l) => (
                <CommandItem key={l.id} value={l.name} onSelect={() => onToggle(l.id)}>
                  <span className="size-2.5 rounded-full" style={{ background: l.color }} aria-hidden />
                  <span className="flex-1 truncate">{l.name}</span>
                  {selected.includes(l.id) ? <Check className="size-3.5 text-muted-foreground" /> : null}
                </CommandItem>
              ))}
              {q && !exists ? (
                <CommandItem
                  value={`__create ${q}`}
                  onSelect={() => {
                    onCreate(q);
                    setQuery("");
                  }}
                >
                  <Plus className="size-3.5" />
                  Crear “{q}”
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
