import { errorMessage } from "@/server/agent/mcp";
import { ServiceError } from "@/server/errors";
import { createBackup, restoreBackup, saveBackupToDisk } from "@/server/services/backup";

export const dynamic = "force-dynamic";

/** Used by the settings page (the UI has no login: local, single user). */
export async function GET() {
  const data = await createBackup();
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="projectos-${data.createdAt.slice(0, 19).replace(/[:T]/g, "-")}.json"`,
    },
  });
}

function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) throw new ServiceError("forbidden", "Origen no permitido");
  if (req.headers.get("x-projectos-confirm") !== "1") throw new ServiceError("forbidden", "Falta la confirmación");
}

/** `?action=save` writes a copy on the server; otherwise restores the uploaded JSON (`?mode=dry` simulates, `?replace=1` overwrites). */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "save") return Response.json(await saveBackupToDisk());
    const body = await req.json().catch(() => {
      throw new ServiceError("invalid", "El archivo no es JSON válido");
    });
    const result = await restoreBackup(body, { dryRun: url.searchParams.get("mode") === "dry", replace: url.searchParams.get("replace") === "1" });
    return Response.json(result);
  } catch (e) {
    const { message, status } = errorMessage(e);
    return Response.json({ error: message }, { status });
  }
}
