import { describeTools } from "@/server/agent/tools";
import { errorMessage } from "@/server/agent/mcp";
import { authenticate } from "@/server/services/tokens";

export const dynamic = "force-dynamic";

/** Catalogue of operations with JSON Schemas (the API's machine-readable documentation). */
export async function GET(req: Request) {
  try {
    const ctx = await authenticate(req.headers.get("authorization"));
    return Response.json({ tools: describeTools().filter((t) => t.scope === "read" || ctx.scope === "write") });
  } catch (e) {
    const { message, status } = errorMessage(e);
    return Response.json({ error: message }, { status });
  }
}
