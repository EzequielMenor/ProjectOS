"use client";

import { useEffect, useState } from "react";
import { DEFAULT_UI_SIZE, UI_SIZES, UI_SIZE_EVENT, setUiSize } from "@/lib/ui-scale";

export function TextSizeControl({ initial }: { initial: number }) {
  const [size, setSize] = useState(initial);
  // the palette can change the size too
  useEffect(() => {
    const onChange = (e: Event) => setSize((e as CustomEvent<number>).detail);
    window.addEventListener(UI_SIZE_EVENT, onChange);
    return () => window.removeEventListener(UI_SIZE_EVENT, onChange);
  }, []);
  const apply = (n: number) => {
    setSize(n); // not only via the event: a click can land before the listener above is attached
    setUiSize(n);
  };
  const i = UI_SIZES.indexOf(size as (typeof UI_SIZES)[number]);
  const btn = "grid h-7 w-8 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div role="group" aria-label="Tamaño de la interfaz" className="flex items-center gap-1 px-2 pb-1 text-[0.875rem] text-muted-foreground">
      <span className="mr-auto">Tamaño</span>
      <button type="button" aria-label="Reducir tamaño de la interfaz" disabled={i <= 0} onClick={() => apply(UI_SIZES[i - 1])} className={`${btn} text-xs`}>
        A−
      </button>
      <button
        type="button"
        aria-label="Restablecer tamaño de la interfaz"
        title="Restablecer"
        onClick={() => apply(DEFAULT_UI_SIZE)}
        className="h-7 min-w-10 rounded-md px-1 text-center tabular-nums hover:bg-sidebar-accent hover:text-foreground"
      >
        {Math.round((size / 16) * 100)}%
      </button>
      <button type="button" aria-label="Aumentar tamaño de la interfaz" disabled={i >= UI_SIZES.length - 1} onClick={() => apply(UI_SIZES[i + 1])} className={`${btn} text-base`}>
        A+
      </button>
    </div>
  );
}
