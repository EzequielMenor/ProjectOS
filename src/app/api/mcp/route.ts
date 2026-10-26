import { errorMessage, handleMcpRequest } from "@/server/agent/mcp";
import { authenticate } from "@/server/services/tokens";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  try {
    const ctx = await authenticate(req.headers.get("authorization"));
    return await handleMcpRequest(req, ctx);
  } catch (e) {
    const { message, status } = errorMessage(e);
    return Response.json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }, { status });
  }
}

export { handle as GET, handle as POST, handle as DELETE };
