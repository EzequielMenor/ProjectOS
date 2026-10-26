import { redirect } from "next/navigation";

export default async function ProjectIndex({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  redirect(`/${project}/list`);
}
