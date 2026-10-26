/** Placeholder shown while a page's data streams in. Same silhouette as the issue views: header, filter row, rows. */
export function LoadingSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex h-full flex-col">
      <span className="sr-only">Cargando…</span>
      <div className="flex h-12 items-center gap-3 border-b px-4" aria-hidden>
        <div className="size-3 animate-pulse rounded-sm bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="ml-auto h-7 w-24 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex-1 space-y-px overflow-hidden" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex h-10 items-center gap-3 border-b px-4">
            <div className="size-3.5 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-14 animate-pulse rounded bg-muted" />
            <div className="h-3 animate-pulse rounded bg-muted" style={{ width: `${30 + ((i * 37) % 40)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
