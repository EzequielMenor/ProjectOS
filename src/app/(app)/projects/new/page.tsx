import { NewProjectForm } from "@/components/new-project-form";

export const metadata = { title: "Nuevo proyecto" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Crea tu primer proyecto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El identificador da nombre a los issues (por ejemplo <code className="font-mono">FICH-12</code>).
        </p>
      </div>
      <NewProjectForm />
    </div>
  );
}
