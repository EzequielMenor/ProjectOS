import { loadProject } from "@/lib/project-page";

// Resolve the project here, before the page streams: once a loading.tsx skeleton has been sent the status is already 200,
// so a missing project would no longer answer 404 if only the page checked it.
export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ project: string }> }) {
  await loadProject(params);
  return children;
}
