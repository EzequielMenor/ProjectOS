import Link from "next/link";
import { SearchX } from "lucide-react";

export function NotFoundView() {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="max-w-md text-center">
        <SearchX className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold">No se ha encontrado</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ese proyecto, issue o página no existe (o se ha movido).</p>
        <Link href="/" className="mx-auto mt-4 grid h-8 w-fit place-items-center rounded-md border px-3 text-sm hover:bg-accent">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
