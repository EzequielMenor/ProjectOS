"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string; icon?: ReactNode };

/** Compact searchable picker used for every issue property (state, priority, ...). */
export function OptionPicker({
  value,
  options,
  onChange,
  children,
  className,
  title,
  align = "start",
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  title: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={title}
        title={title}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent",
          className,
        )}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-56 gap-0 p-0" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder={`${title}…`} />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            {options.map((o) => (
              <CommandItem
                key={o.value}
                value={o.label}
                onSelect={() => {
                  setOpen(false);
                  if (o.value !== value) onChange(o.value);
                }}
              >
                {o.icon}
                <span className="flex-1 truncate">{o.label}</span>
                {o.value === value ? <Check className="size-3.5 text-muted-foreground" /> : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
