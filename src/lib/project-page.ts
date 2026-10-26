import { notFound } from "next/navigation";
import { ServiceError } from "@/server/errors";
import { getProjectByIdentifier } from "@/server/services/projects";

/** Resolves the `[project]` route segment or renders the 404 page. */
export async function loadProject(params: Promise<{ project: string }>) {
  const { project } = await params;
  return getProjectByIdentifier(project).catch((e) => {
    if (e instanceof ServiceError && e.code === "not_found") notFound();
    throw e;
  });
}
