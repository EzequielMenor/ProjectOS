import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ZodError } from "zod";
import { ServiceError } from "../errors";
import type { AuthContext } from "../services/tokens";
import { TOOLS, callTool } from "./tools";

export function errorMessage(e: unknown): { message: string; status: number } {
  if (e instanceof ServiceError) {
    const status = { not_found: 404, invalid: 400, conflict: 409, forbidden: 403 }[e.code];
    return { message: e.message, status };
  }
  if (e instanceof ZodError) return { message: e.issues.map((i) => `${i.path.join(".") || "args"}: ${i.message}`).join("; "), status: 400 };
  console.error(e);
  return { message: "Error interno", status: 500 };
}

/** Builds a per-request MCP server exposing only the tools this token's scope allows. */
export function buildMcpServer(ctx: AuthContext) {
  const server = new McpServer({ name: "projectos", version: "0.1.0" });
  for (const t of TOOLS) {
    if (t.scope === "write" && ctx.scope !== "write") continue;
    server.registerTool(
      t.name,
      {
        description: t.description,
        inputSchema: t.shape,
        annotations: { readOnlyHint: t.scope === "read", destructiveHint: false, openWorldHint: false },
      },
      async (args: unknown) => {
        try {
          const result = await callTool(t.name, args, ctx);
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        } catch (e) {
          return { isError: true, content: [{ type: "text" as const, text: errorMessage(e).message }] };
        }
      },
    );
  }
  return server;
}

/** Stateless Streamable HTTP: one server + transport per request. */
export async function handleMcpRequest(req: Request, ctx: AuthContext) {
  const server = buildMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}
