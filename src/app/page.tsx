import { redirect } from "next/navigation";
import { listProjects } from "@/server/services/projects";

export default async function Home() {
  const projects = await listProjects();
  redirect(projects[0] ? `/${projects[0].identifier}/list` : "/projects/new");
}
