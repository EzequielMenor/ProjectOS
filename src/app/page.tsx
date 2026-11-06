import { redirect } from "next/navigation";
import { isDemoMode } from "@/db/client";
import { listProjects } from "@/server/services/projects";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = await listProjects();
  const defaultView = isDemoMode() ? "board" : "list";
  redirect(projects[0] ? `/${projects[0].identifier}/${defaultView}` : "/projects/new");
}
