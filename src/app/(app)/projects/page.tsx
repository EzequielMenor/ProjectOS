import { ProjectPortfolio } from "@/components/project-portfolio";
import { filterProjects, parsePortfolioQuery } from "@/lib/project-status";
import { listProjectDashboard } from "@/server/services/project-dashboard";

export const metadata = { title: "Proyectos" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parsePortfolioQuery(await searchParams);
  const all = await listProjectDashboard();
  return <ProjectPortfolio projects={filterProjects(all, query)} allProjects={all} query={query} />;
}
