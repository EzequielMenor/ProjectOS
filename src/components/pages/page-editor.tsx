"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ChevronRight, History, Pencil, Eye } from "lucide-react";
import { archivePageAction, restorePageVersionAction, updatePageAction } from "@/app/actions";
import { Markdown } from "@/components/markdown";
import { Textarea } from "@/components/ui/textarea";
import { linkify, type Resolved } from "@/lib/page-links";

type Props = {
  identifier: string;
  projectName: string;
  page: { id: string; title: string; content: string; updatedAt: string; archived: boolean };
  resolved: Resolved;
  links: {
    issues: { key: string; identifier: string; seq: number; title: string }[];
    outgoing: { id: string; title: string }[];
    backlinks: { id: string; title: string }[];
  };
  versions: { id: string; title: string; actor: string; createdAt: string; chars: number }[];
};

const fmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

export function PageEditor({ identifier, projectName, page, resolved, links, versions }: Props) {
  const router = useRouter();
  const [, start] = useTransition();
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [mode, setMode] = useState<"view" | "edit">(page.content ? "view" : "edit");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState({ title: page.title, content: page.content, updatedAt: page.updatedAt });
  const dirty = title !== saved.title || content !== saved.content;

  const save = async () => {
    if (!dirty || !title.trim()) return;
    setSaving(true);
    const res = await updatePageAction(page.id, { title, content, expectedUpdatedAt: saved.updatedAt });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSaved({ title, content, updatedAt: res.data.updatedAt });
    router.refresh();
  };

  // Ctrl/Cmd+S saves; leaving with unsaved edits asks first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, title, content, saved]);

  const restore = (versionId: string) =>
    start(async () => {
      const res = await restorePageVersionAction(page.id, versionId);
      if (!res.ok) toast.error(res.error);
      else window.location.reload(); // content changed underneath this component: refetch it all
    });

  const archive = () =>
    start(async () => {
      const res = await archivePageAction(page.id, !page.archived);
      if (!res.ok) toast.error(res.error);
      else if (!page.archived) router.push(`/${identifier}/pages`);
      else router.refresh();
    });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b px-4 text-sm">
        <Link href={`/${identifier}/pages`} className="text-muted-foreground hover:text-foreground">
          {projectName} · Docs
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="truncate">{title}</span>
        {page.archived ? <span className="rounded border px-1 text-[10px] uppercase text-muted-foreground">archivada</span> : null}
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {saving ? "Guardando…" : dirty ? "Sin guardar" : "Guardado"}
        </span>
        <button
          onClick={() => (mode === "edit" ? (void save(), setMode("view")) : setMode("edit"))}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs hover:bg-accent"
        >
          {mode === "edit" ? <Eye className="size-3.5" /> : <Pencil className="size-3.5" />}
          {mode === "edit" ? "Vista previa" : "Editar"}
        </button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[1fr_16rem] lg:overflow-hidden">
        <article className="mx-auto w-full max-w-3xl px-6 py-8 lg:overflow-y-auto">
          <input
            aria-label="Título de la página"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void save()}
            className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none"
          />
          {mode === "edit" ? (
            <Textarea
              aria-label="Contenido (Markdown)"
              value={content}
              placeholder="Escribe en Markdown. Enlaza issues con FICH-12 o [[FICH-12]] y páginas con [[Título]]."
              onChange={(e) => setContent(e.target.value)}
              onBlur={() => void save()}
              className="mt-4 min-h-[60vh] resize-y font-mono text-[13px]"
              autoFocus={!page.content}
            />
          ) : (
            <div className="mt-4" data-testid="page-preview">
              {content ? <Markdown>{linkify(content, resolved)}</Markdown> : <p className="text-sm text-muted-foreground">Página vacía.</p>}
            </div>
          )}
        </article>
        <aside className="flex flex-col gap-6 border-t p-4 text-sm lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Enlaces e historial">
          <section aria-label="Enlaces">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Menciona</h2>
            {links.issues.length || links.outgoing.length ? (
              <ul className="flex flex-col gap-0.5">
                {links.issues.map((i) => (
                  <li key={i.key}>
                    <Link href={`/${i.identifier}/issues/${i.seq}`} className="flex gap-2 rounded px-1 py-0.5 hover:bg-accent" title={i.title}>
                      <span className="font-mono text-xs text-muted-foreground">{i.key}</span>
                      <span className="truncate">{i.title}</span>
                    </Link>
                  </li>
                ))}
                {links.outgoing.map((p) => (
                  <li key={p.id}>
                    <Link href={`/${identifier}/pages/${p.id}`} className="block truncate rounded px-1 py-0.5 hover:bg-accent">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nada todavía.</p>
            )}
            <h2 className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Enlazada desde</h2>
            {links.backlinks.length ? (
              <ul className="flex flex-col gap-0.5">
                {links.backlinks.map((p) => (
                  <li key={p.id}>
                    <Link href={`/${identifier}/pages/${p.id}`} className="block truncate rounded px-1 py-0.5 hover:bg-accent">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Ninguna página enlaza aquí.</p>
            )}
          </section>
          <section aria-label="Historial">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <History className="size-3.5" /> Historial
            </h2>
            {versions.length ? (
              <ul className="flex flex-col gap-1">
                {versions.slice(0, 15).map((v) => (
                  <li key={v.id} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{fmt.format(new Date(v.createdAt))}</span>
                      <span className="text-muted-foreground">{v.actor} · {v.chars} car.</span>
                    </span>
                    <button onClick={() => restore(v.id)} disabled={dirty} title={dirty ? "Guarda antes de restaurar" : "Restaurar esta versión"} className="rounded border px-1.5 py-0.5 hover:bg-accent disabled:opacity-50">
                      Restaurar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Sin versiones anteriores. Cada edición guarda la anterior.</p>
            )}
          </section>
          <button onClick={archive} className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground">
            {page.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
            {page.archived ? "Desarchivar" : "Archivar"}
          </button>
        </aside>
      </div>
    </div>
  );
}
