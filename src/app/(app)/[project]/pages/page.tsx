import Link from "next/link";
import { FileText } from "lucide-react";
import { NewPageForm } from "@/components/pages/new-page-form";
import { loadProject } from "@/lib/project-page";
import { listPages } from "@/server/services/pages";

export const metadata = { title: "Docs" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("es", { dateStyle: "medium" });

export default async function Page({ params }: { params: Promise<{ project: string }> }) {
  const project = await loadProject(params);
  const pages = await listPages(project.id);
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Docs</h1>
      <p className="mt-1 text-sm text-muted-foreground">Páginas en Markdown. Enlaza issues con FICH-12 o [[FICH-12]] y otras páginas con [[Título]].</p>
      <NewPageForm projectId={project.id} identifier={project.identifier} />
      {pages.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Aún no hay páginas. Crea la primera: una decisión, un PRD, notas de arquitectura…</p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {pages.map((p) => (
            <li key={p.id}>
              <Link href={`/${project.identifier}/pages/${p.id}`} className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent" data-testid="page-row">
                <FileText className="size-4 text-muted-foreground" />
                <span className="truncate font-medium">{p.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{fmt.format(p.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
