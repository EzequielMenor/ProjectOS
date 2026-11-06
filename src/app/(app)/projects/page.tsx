import { ProjectPortfolio } from "@/components/project-portfolio";
import { filterProjects, parsePortfolioQuery } from "@/lib/project-status";
import { listProjects } from "@/server/services/projects";

export const metadata = { title: "Proyectos" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parsePortfolioQuery(await searchParams);
  const all = (await listProjects({ includeArchived: true })).map((p) => ({
    id: p.id,
    identifier: p.identifier,
    name: p.name,
    description: p.description,
    color: p.color,
    status: p.status,
    archived: p.archivedAt !== null,
  }));
  return <ProjectPortfolio projects={filterProjects(all, query)} total={all.length} query={query} />;
}
