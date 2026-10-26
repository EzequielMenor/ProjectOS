import { errorMessage } from "@/server/agent/mcp";
import { callTool } from "@/server/agent/tools";
import { authenticate } from "@/server/services/tokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const ctx = await authenticate(req.headers.get("authorization"));
    const { name } = await params;
    const body = await req.json().catch(() => ({}));
    return Response.json({ result: await callTool(name, body, ctx) });
  } catch (e) {
    const { message, status } = errorMessage(e);
    return Response.json({ error: message }, { status });
  }
}
