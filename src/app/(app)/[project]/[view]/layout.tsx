import { notFound } from "next/navigation";

// Same reason as the project layout: an unknown view must 404 before the loading skeleton is streamed.
export default async function ViewLayout({ children, params }: { children: React.ReactNode; params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (view !== "list" && view !== "board" && view !== "table") notFound();
  return children;
}
